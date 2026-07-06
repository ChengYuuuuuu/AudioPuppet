import sys, os
sys.path.insert(0, os.path.join('backend', 'sofa_source'))
import numpy as np
import soundfile as sf

sr = 44100
duration = 2.0
t = np.linspace(0, duration, int(sr * duration))
audio = np.sin(2 * np.pi * 440 * t) * 0.3
sf.write('test_alignment.wav', audio, sr)

sys.path.insert(0, 'backend')
from sofa_aligner import SofaAligner
a = SofaAligner(
    'backend/sofa_source/ckpt/v1.0.0_mandarin_singing.ckpt',
    'backend/sofa_source/dictionary/opencpop-extension.txt'
)
result = a.align('test_alignment.wav', '测试音频')
print('Success:', result['success'])
print('Phonemes count:', len(result['phonemes']))
print('Confidence:', result.get('confidence'))
if result['phonemes']:
    for ph in result['phonemes'][:10]:
        print(f'  {ph["ph"]}: {ph["start"]:.3f}-{ph["end"]:.3f}')
