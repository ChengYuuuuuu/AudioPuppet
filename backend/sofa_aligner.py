import os
import re
import sys
import logging

import numpy as np
import torch
import librosa

log = logging.getLogger(__name__)

SOFA_SOURCE_DIR = os.path.join(os.path.dirname(__file__), "sofa_source")
if SOFA_SOURCE_DIR not in sys.path:
    sys.path.insert(0, SOFA_SOURCE_DIR)

from modules.g2p.dictionary_g2p import DictionaryG2P
from modules.task.forced_alignment import LitForcedAlignmentTask


class SofaAligner:
    def __init__(self, ckpt_path: str, dict_path: str, ja_dict_path: str = None,
                 en_ckpt_path: str = None, en_dict_path: str = None):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        log.info(f"Using device: {self.device}")

        # ── Mandarin model (always loaded) ──
        log.info(f"Loading Mandarin SOFA model from {ckpt_path}...")
        self.model = LitForcedAlignmentTask.load_from_checkpoint(ckpt_path)
        self.model.set_inference_mode("force")
        self.model.to(self.device)
        self.model.eval()
        self.g2p = DictionaryG2P(dictionary=dict_path)
        self.g2p_ja = DictionaryG2P(dictionary=ja_dict_path) if ja_dict_path and os.path.exists(ja_dict_path) else None
        self.melspec_config = self.model.melspec_config
        self.model.get_melspec = None
        log.info(f"Mandarin model loaded (vocab_size={self.model.vocab['<vocab_size>']}, "
                 f"sr={self.melspec_config['sample_rate']})")

        # ── English model (optional) ──
        self.model_en = None
        self.g2p_en = None
        self.melspec_config_en = None
        if en_ckpt_path and os.path.exists(en_ckpt_path):
            log.info(f"Loading English SOFA model from {en_ckpt_path}...")
            self.model_en = LitForcedAlignmentTask.load_from_checkpoint(en_ckpt_path)
            self.model_en.set_inference_mode("force")
            self.model_en.to(self.device)
            self.model_en.eval()
            self.melspec_config_en = self.model_en.melspec_config
            self.model_en.get_melspec = None
            if en_dict_path and os.path.exists(en_dict_path):
                self.g2p_en = DictionaryG2P(dictionary=en_dict_path)
            log.info(f"English model loaded (vocab_size={self.model_en.vocab['<vocab_size>']}, "
                     f"sr={self.melspec_config_en['sample_rate']})")
        else:
            log.info("No English SOFA model configured, English analysis will be skipped")

    @staticmethod
    def _strip_line(clean: str) -> str:
        for sep in [' // ', ' / ', '//', '/']:
            idx = clean.find(sep)
            if idx > 0:
                return clean[:idx].strip()
        m = re.match(r'^(.+?)[（(]([^）)]+)[）)]\s*$', clean)
        if m:
            return m.group(1).strip()
        return clean.strip()

    def _extract_lyrics_text(self, lrc_text: str, lang_filter: str = None) -> str:
        lines = lrc_text.strip().split("\n")
        text_parts = []
        for line in lines:
            clean = re.sub(r'\[\d{2}:\d{2}(?:\.\d+)?\]', '', line).strip()
            clean = re.sub(r'\[[a-z]+:.*?\]', '', clean).strip()
            clean = self._strip_line(clean)
            if not clean:
                continue
            if lang_filter == "ja" and not self._is_japanese(clean):
                continue
            if lang_filter == "en" and not self._is_english(clean):
                continue
            if lang_filter == "zh" and not bool(re.search(r'[\u4e00-\u9fff]', clean)):
                continue
            text_parts.append(clean)
        return " ".join(text_parts)

    def _chinese_to_pinyin(self, text: str) -> str:
        try:
            import pypinyin
            pinyin_list = pypinyin.lazy_pinyin(text, style=pypinyin.Style.NORMAL)
            return " ".join(pinyin_list)
        except ImportError:
            log.warning("pypinyin not installed, assuming text is already pinyin")
            return text

    @staticmethod
    def _is_japanese(text: str) -> bool:
        return bool(re.search(r'[\u3040-\u309f\u30a0-\u30ff]', text))

    @staticmethod
    def _is_english(text: str) -> bool:
        if not re.search(r'[a-zA-Z]', text):
            return False
        if re.search(r'[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]', text):
            return False
        return True

    def _japanese_to_romaji_mora(self, text: str) -> str:
        try:
            import pykakasi
            kks = pykakasi.kakasi()
            result = kks.convert(text)
            hira = "".join(item["hira"] for item in result)
            small = set("ぁぃぅぇぉゃゅょゎっァィゥェォャュョヮッ")
            mora = []
            buf = ""
            for ch in hira:
                if ch in small:
                    buf += ch
                else:
                    if buf:
                        mora.append(buf)
                    buf = ch
            if buf:
                mora.append(buf)
            romaji_mora = []
            for m in mora:
                r = kks.convert(m)
                romaji_mora.append(r[0]["hepburn"] if r else m)
            return " ".join(romaji_mora)
        except ImportError:
            log.warning("pykakasi not installed, falling back to raw text for Japanese")
            return text

    def _english_g2p_fallback(self, text: str) -> tuple:
        try:
            from g2p_en import G2p
        except ImportError:
            log.error("g2p-en not installed, cannot process English text")
            return (["SP"], [], [-1])

        # ARPABET (g2p-en output) → TGM English model phoneme mapping
        arpabet_to_tgm = {
            'AA': 'aa', 'AE': 'ae', 'AH': 'ah', 'AO': 'ao',
            'AW': 'aw', 'AY': 'ay', 'EH': 'eh', 'ER': 'er',
            'EY': 'ey', 'IH': 'ih', 'IY': 'iy', 'OW': 'ow',
            'OY': 'oy', 'UH': 'uh', 'UW': 'uw',
            'B': 'b', 'CH': 'ch', 'D': 'd', 'DH': 'dh',
            'F': 'f', 'G': 'g', 'HH': 'hh', 'JH': 'jh',
            'K': 'k', 'L': 'l', 'M': 'm', 'N': 'n',
            'NG': 'ng', 'P': 'p', 'R': 'r', 'S': 's',
            'SH': 'sh', 'T': 't', 'TH': 'th', 'V': 'v',
            'W': 'w', 'Y': 'y', 'Z': 'z', 'ZH': 'zh',
        }

        g2p = G2p()
        words = text.strip().split()
        ph_seq = ["SP"]
        word_seq = []
        ph_idx_to_word_idx = [-1]
        word_idx = 0

        for word in words:
            word_clean = word.strip(",.!?;:'\"()[]{}").lower()
            if not word_clean:
                continue
            arpabet_phones = g2p(word_clean)
            mapped = []
            for ph in arpabet_phones:
                ph_clean = ph.replace("0", "").replace("1", "").replace("2", "")
                tgm_ph = arpabet_to_tgm.get(ph_clean)
                if tgm_ph is not None:
                    mapped.append(tgm_ph)
            if not mapped:
                continue
            word_seq.append(word_clean)
            for ph in mapped:
                ph_seq.append(ph)
                ph_idx_to_word_idx.append(word_idx)
            if ph_seq[-1] != "SP":
                ph_seq.append("SP")
                ph_idx_to_word_idx.append(-1)
            word_idx += 1

        return ph_seq, word_seq, ph_idx_to_word_idx

    def _preprocess_text(self, lyrics_text: str) -> tuple:
        plain = self._extract_lyrics_text(lyrics_text)
        if not plain.strip():
            return ("", None)
        plain = re.sub(r'\s+', ' ', plain).strip()

        if self._is_japanese(plain):
            processed = self._japanese_to_romaji_mora(plain)
            has_chinese_or_en = bool(re.search(r'[\u4e00-\u9fffa-zA-Z]', processed))
            if has_chinese_or_en:
                ja_plain = self._extract_lyrics_text(lyrics_text, lang_filter="ja")
                if ja_plain.strip():
                    return (self._japanese_to_romaji_mora(ja_plain), "ja")
            return (processed, "ja")

        has_chinese = bool(re.search(r'[\u4e00-\u9fff]', plain))
        has_english = bool(re.search(r'[a-zA-Z]', plain))

        if has_chinese and has_english:
            en_plain = self._extract_lyrics_text(lyrics_text, lang_filter="en")
            if en_plain.strip():
                return (en_plain, "en")
            return (self._chinese_to_pinyin(plain), "zh")

        if has_chinese:
            return (self._chinese_to_pinyin(plain), "zh")
        if self._is_english(plain):
            return (plain, "en")
        return (plain, None)

    def align(self, audio_path: str, lyrics_text: str) -> dict:
        processed_text, lang = self._preprocess_text(lyrics_text)
        if not processed_text.strip():
            log.warning("Empty lyrics text after preprocessing")
            return {"success": False, "phonemes": [], "words": [], "confidence": 0.0}

        log.info(f"[lang={lang}] Processed text ({len(processed_text)} chars): {processed_text[:200]}...")

        # G2P
        if lang == "ja" and self.g2p_ja is not None:
            g2p = self.g2p_ja
            ph_seq, word_seq, ph_idx_to_word_idx = g2p._g2p(processed_text)
        elif lang == "en" and self.g2p_en is not None:
            ph_seq, word_seq, ph_idx_to_word_idx = self.g2p_en._g2p(processed_text)
        elif lang == "en" and self.model_en is not None:
            ph_seq, word_seq, ph_idx_to_word_idx = self._english_g2p_fallback(processed_text)
        else:
            g2p = self.g2p
            ph_seq, word_seq, ph_idx_to_word_idx = g2p._g2p(processed_text)

        if len(ph_seq) < 2:
            log.warning("No valid phonemes after G2P conversion")
            return {"success": False, "phonemes": [], "words": [], "confidence": 0.0}

        log.info(f"G2P: {len(ph_seq)} phonemes, {len(word_seq)} words")

        # Load audio at target sample rate
        if lang == "en" and self.model_en is not None:
            sr = self.melspec_config_en["sample_rate"]
            model = self.model_en
            melspec_config = self.melspec_config_en
        else:
            sr = self.melspec_config["sample_rate"]
            model = self.model
            melspec_config = self.melspec_config

        waveform, _ = librosa.load(audio_path, sr=sr, mono=True)
        wav_length = len(waveform) / sr

        result = self._infer(model, melspec_config, waveform, wav_length,
                             ph_seq, word_seq, ph_idx_to_word_idx)
        if result is None:
            return {"success": False, "phonemes": [], "words": [], "confidence": 0.0}

        ph_seq_pred, ph_intervals_pred, word_seq_pred, word_intervals_pred, confidence = result

        phonemes = [
            {"ph": str(ph), "start": float(start), "end": float(end)}
            for ph, (start, end) in zip(ph_seq_pred, ph_intervals_pred)
        ]
        words = [
            {"text": str(t), "start": float(start), "end": float(end)}
            for t, (start, end) in zip(word_seq_pred, word_intervals_pred)
        ]

        log.info(f"SOFA alignment: {len(phonemes)} phonemes, confidence={confidence:.4f}")
        return {"success": True, "phonemes": phonemes, "words": words, "confidence": float(confidence)}

    @torch.no_grad()
    def _infer(self, model, melspec_config, waveform, wav_length,
               ph_seq, word_seq, ph_idx_to_word_idx):
        from modules.utils.get_melspec import MelSpecExtractor
        from modules.utils.post_processing import fill_small_gaps, add_SP
        from einops import repeat

        try:
            if model.get_melspec is None:
                model.get_melspec = MelSpecExtractor(**melspec_config)

            wav_t = torch.from_numpy(waveform).float().to(self.device)
            melspec = model.get_melspec(wav_t).detach().unsqueeze(0)
            melspec = (melspec - melspec.mean()) / melspec.std()
            melspec = repeat(melspec, "B C T -> B C (T N)", N=melspec_config["scale_factor"])

            ph_frame_logits, ph_edge_logits, _ = model.forward(melspec.transpose(1, 2))

            num_frames = int(
                (wav_length * melspec_config["scale_factor"] * melspec_config["sample_rate"] + 0.5)
                / melspec_config["hop_length"]
            )
            ph_frame_logits = ph_frame_logits[:, :num_frames, :]
            ph_edge_logits = ph_edge_logits[:, :num_frames]

            vocab = model.vocab
            ph_seq_id = np.array([vocab[ph] for ph in ph_seq])

            ph_mask = np.zeros(vocab["<vocab_size>"])
            ph_mask[ph_seq_id] = 1
            ph_mask[0] = 1
            ph_mask_t = torch.from_numpy(ph_mask).float().to(self.device)
            ph_mask_t = ph_mask_t.unsqueeze(0).unsqueeze(0).logical_not() * 1e9

            ph_prob_log = (
                torch.log_softmax(ph_frame_logits.float() - ph_mask_t.float(), dim=-1)
                .squeeze(0).cpu().numpy().astype("float32")
            )
            ph_edge_pred = (
                (torch.nn.functional.sigmoid(ph_edge_logits.float()) - 0.1) / 0.8
            ).clamp(0.0, 1.0).squeeze(0).cpu().numpy().astype("float32")

            T = ph_prob_log.shape[0]
            edge_diff = np.concatenate((np.diff(ph_edge_pred, axis=0), [0]), axis=0)
            edge_prob = (ph_edge_pred + np.concatenate(([0], ph_edge_pred[:-1]))).clip(0, 1)

            ph_idx_seq, ph_time_int_pred, frame_confidence = model._decode(
                ph_seq_id, ph_prob_log, edge_prob
            )

            frame_length = melspec_config["hop_length"] / (
                melspec_config["sample_rate"] * melspec_config["scale_factor"]
            )
            ph_time_fractional = (edge_diff[ph_time_int_pred] / 2).clip(-0.5, 0.5)
            ph_time_pred = frame_length * np.concatenate([
                ph_time_int_pred.astype("float32") + ph_time_fractional, [T]
            ])
            ph_intervals = np.stack([ph_time_pred[:-1], ph_time_pred[1:]], axis=1)

            ph_seq_pred = []
            ph_intervals_pred = []
            word_seq_pred = []
            word_intervals_pred = []
            word_idx_last = -1

            for i, ph_idx in enumerate(ph_idx_seq):
                if ph_seq[ph_idx] == "SP":
                    continue
                ph_seq_pred.append(ph_seq[ph_idx])
                ph_intervals_pred.append(ph_intervals[i, :])
                word_idx = ph_idx_to_word_idx[ph_idx]
                if word_idx == word_idx_last:
                    word_intervals_pred[-1][1] = ph_intervals[i, 1]
                else:
                    word_seq_pred.append(word_seq[word_idx])
                    word_intervals_pred.append([ph_intervals[i, 0], ph_intervals[i, 1]])
                    word_idx_last = word_idx

            ph_seq_pred = np.array(ph_seq_pred)
            ph_intervals_pred = np.array(ph_intervals_pred).clip(min=0, max=None)
            word_seq_pred = np.array(word_seq_pred)
            word_intervals_pred = np.array(word_intervals_pred).clip(min=0, max=None)

            total_confidence = np.exp(np.mean(np.log(frame_confidence + 1e-6)) / 3)

            word_seq_pred, word_intervals_pred = fill_small_gaps(word_seq_pred, word_intervals_pred, wav_length)
            ph_seq_pred, ph_intervals_pred = fill_small_gaps(ph_seq_pred, ph_intervals_pred, wav_length)
            word_seq_pred, word_intervals_pred = add_SP(word_seq_pred, word_intervals_pred, wav_length)
            ph_seq_pred, ph_intervals_pred = add_SP(ph_seq_pred, ph_intervals_pred, wav_length)

            return (ph_seq_pred, ph_intervals_pred, word_seq_pred, word_intervals_pred, total_confidence)

        except Exception:
            log.exception("SOFA inference failed")
            return None
