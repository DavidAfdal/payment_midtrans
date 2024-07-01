
import crypto from "crypto";

export const GeneratorOrderId = () => {
    // Menggunakan `crypto.randomBytes` untuk menghasilkan angka acak
    const id = crypto.randomBytes(16).toString('hex');
    return `ORDER-${id}`;
  }

