#!/usr/bin/env python3
"""Gera ícones PWA em vários tamanhos a partir do ícone do app."""
from PIL import Image
import os

src = os.path.join(os.path.dirname(__file__), "../assets/images/icon.png")
out_dir = os.path.join(os.path.dirname(__file__), "../public/icons")
os.makedirs(out_dir, exist_ok=True)

img = Image.open(src).convert("RGBA")
sizes = [72, 96, 128, 144, 152, 192, 384, 512]
for s in sizes:
    resized = img.resize((s, s), Image.LANCZOS)
    out_path = os.path.join(out_dir, f"icon-{s}x{s}.png")
    resized.save(out_path)
    print(f"Gerado: {out_path}")

print("Ícones PWA gerados com sucesso!")
