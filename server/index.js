const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// API requests now go directly to the remote API (see neteaseApi.ts)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
