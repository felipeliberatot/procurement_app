import bcrypt from "bcryptjs";

const pin = "cgs@2026";
const hash = await bcrypt.hash(pin, 12);
console.log(hash);
