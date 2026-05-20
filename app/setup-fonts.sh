#!/usr/bin/env bash
# Завантажує open-source TTF шрифти, потрібні для функції «Текст → криві».
# Тягнемо з github.com через raw.githubusercontent.com (без CORS — це нормально для curl).
# Запуск: ./setup-fonts.sh

set -euo pipefail
cd "$(dirname "$0")"

mkdir -p fonts

# format: "target_filename|full_url"
FONTS=(
  # Roboto family (sans-serif) — repo googlefonts/roboto, тека src/hinted
  "Roboto-Regular.ttf|https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf"
  "Roboto-Bold.ttf|https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf"
  "Roboto-Italic.ttf|https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Italic.ttf"
  "Roboto-BoldItalic.ttf|https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-BoldItalic.ttf"
  "Roboto-Black.ttf|https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Black.ttf"
  "Roboto-BlackItalic.ttf|https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-BlackItalic.ttf"

  # Roboto Condensed (Arial Narrow alternative)
  "RobotoCondensed-Regular.ttf|https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/RobotoCondensed-Regular.ttf"
  "RobotoCondensed-Bold.ttf|https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/RobotoCondensed-Bold.ttf"
  "RobotoCondensed-Italic.ttf|https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/RobotoCondensed-Italic.ttf"
  "RobotoCondensed-BoldItalic.ttf|https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/RobotoCondensed-BoldItalic.ttf"

  # Roboto Slab (serif) — окремий repo googlefonts/RobotoSlab
  "RobotoSlab-Regular.ttf|https://raw.githubusercontent.com/googlefonts/RobotoSlab/main/fonts/ttf/RobotoSlab-Regular.ttf"
  "RobotoSlab-Bold.ttf|https://raw.githubusercontent.com/googlefonts/RobotoSlab/main/fonts/ttf/RobotoSlab-Bold.ttf"

  # Roboto Mono — окремий repo googlefonts/RobotoMono
  "RobotoMono-Regular.ttf|https://raw.githubusercontent.com/googlefonts/RobotoMono/main/fonts/ttf/RobotoMono-Regular.ttf"
  "RobotoMono-Bold.ttf|https://raw.githubusercontent.com/googlefonts/RobotoMono/main/fonts/ttf/RobotoMono-Bold.ttf"
  "RobotoMono-Italic.ttf|https://raw.githubusercontent.com/googlefonts/RobotoMono/main/fonts/ttf/RobotoMono-Italic.ttf"
  "RobotoMono-BoldItalic.ttf|https://raw.githubusercontent.com/googlefonts/RobotoMono/main/fonts/ttf/RobotoMono-BoldItalic.ttf"

  # Anton (Impact alternative)
  "Anton-Regular.ttf|https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf"

  # Antonio — варіативний (для попереднього перегляду через CSS @font-face)
  "Antonio-VF.ttf|https://raw.githubusercontent.com/google/fonts/main/ofl/antonio/Antonio%5Bwght%5D.ttf"

  # Oswald — варіативний (вісь wght 200..700), популярна display-гарнітура
  "Oswald-VF.ttf|https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/Oswald%5Bwght%5D.ttf"

  # Bebas Neue — статична, тільки Regular (як і реальний Impact)
  "BebasNeue-Regular.ttf|https://raw.githubusercontent.com/google/fonts/main/ofl/bebasneue/BebasNeue-Regular.ttf"
)

ok=0
fail=0
for entry in "${FONTS[@]}"; do
  target="${entry%%|*}"
  url="${entry##*|}"
  out="fonts/$target"
  if [[ -s "$out" ]]; then
    echo "  ✓ $target (вже є)"
    ok=$((ok + 1))
    continue
  fi
  echo "  ⬇ $target"
  if curl -fsSL "$url" -o "$out"; then
    ok=$((ok + 1))
  else
    echo "  ✗ не вдалось: $url" >&2
    rm -f "$out"
    fail=$((fail + 1))
  fi
done

echo
# Microsoft Core Fonts (Arial, Times, Verdana, Georgia, Impact) — копіюємо з системи,
# якщо встановлено пакетом ttf-ms-fonts (Manjaro/Arch). Це робить «Текст у криві»
# справжнім Arial/Times замість open-source аналогів (Roboto/Roboto Slab).
copy_ms_font() {
  local name="$1" target="$2" src
  for d in /usr/share/fonts/TTF /usr/share/fonts/truetype/msttcorefonts /usr/local/share/fonts ~/.local/share/fonts ~/.fonts; do
    for ext in ttf TTF; do
      src="$d/$name.$ext"
      if [[ -f "$src" ]]; then
        cp "$src" "fonts/$target"
        ok=$((ok + 1))
        echo "  ✓ $target (з $src)"
        return 0
      fi
    done
  done
  echo "  · $target — не знайдено в системі (буде fallback на Roboto)"
  return 1
}

echo "=== Microsoft Core Fonts (з системи) ==="
# Arial: Microsoft naming → Arialbd=Bold, Ariali=Italic, Arialbi=BoldItalic
copy_ms_font Arial    Arial-Regular.ttf
copy_ms_font Arialbd  Arial-Bold.ttf
copy_ms_font Ariali   Arial-Italic.ttf
copy_ms_font Arialbi  Arial-BoldItalic.ttf
# Times New Roman
copy_ms_font Times    Times-Regular.ttf
copy_ms_font Timesbd  Times-Bold.ttf
copy_ms_font Timesi   Times-Italic.ttf
copy_ms_font Timesbi  Times-BoldItalic.ttf
# Verdana — суфікс "z" у Microsoft = BoldItalic
copy_ms_font Verdana  Verdana-Regular.ttf
copy_ms_font Verdanab Verdana-Bold.ttf
copy_ms_font Verdanai Verdana-Italic.ttf
copy_ms_font Verdanaz Verdana-BoldItalic.ttf
# Georgia
copy_ms_font Georgia  Georgia-Regular.ttf
copy_ms_font Georgiab Georgia-Bold.ttf
copy_ms_font Georgiai Georgia-Italic.ttf
copy_ms_font Georgiaz Georgia-BoldItalic.ttf
# Impact, Tahoma, Trebuchet, Courier
copy_ms_font Impact   Impact-Regular.ttf
copy_ms_font Tahoma   Tahoma-Regular.ttf
copy_ms_font Tahomabd Tahoma-Bold.ttf
copy_ms_font Trebuc   Trebuchet-Regular.ttf
copy_ms_font Trebucbd Trebuchet-Bold.ttf
copy_ms_font Trebucit Trebuchet-Italic.ttf
copy_ms_font Trebucbi Trebuchet-BoldItalic.ttf
copy_ms_font Cour     Courier-Regular.ttf
copy_ms_font Courbd   Courier-Bold.ttf
copy_ms_font Couri    Courier-Italic.ttf
copy_ms_font Courbi   Courier-BoldItalic.ttf

echo
# Antonio static Regular + Bold come from a ZIP (gwfh). Download + unzip if missing.
if [[ ! -s "fonts/Antonio-Regular.ttf" || ! -s "fonts/Antonio-Bold.ttf" ]]; then
  echo "  ⬇ Antonio-Regular.ttf + Antonio-Bold.ttf (ZIP від google-webfonts-helper)"
  tmp_zip="$(mktemp --suffix=.zip)"
  if curl -fsSL -o "$tmp_zip" \
       "https://gwfh.mranftl.com/api/fonts/antonio?download=zip&subsets=latin&variants=regular,700&formats=ttf"; then
    tmp_dir="$(mktemp -d)"
    if unzip -j -o "$tmp_zip" -d "$tmp_dir" >/dev/null; then
      # File names look like antonio-vNN-latin-{regular,700}.ttf
      reg="$(ls "$tmp_dir"/antonio-*-latin-regular.ttf 2>/dev/null | head -1)"
      bold="$(ls "$tmp_dir"/antonio-*-latin-700.ttf 2>/dev/null | head -1)"
      [[ -n "$reg" ]]  && mv "$reg"  fonts/Antonio-Regular.ttf && ok=$((ok + 1))
      [[ -n "$bold" ]] && mv "$bold" fonts/Antonio-Bold.ttf    && ok=$((ok + 1))
    fi
    rm -rf "$tmp_dir"
  else
    echo "  ✗ не вдалось завантажити Antonio ZIP" >&2
    fail=$((fail + 2))
  fi
  rm -f "$tmp_zip"
else
  echo "  ✓ Antonio-Regular.ttf, Antonio-Bold.ttf (вже є)"
  ok=$((ok + 2))
fi

echo
echo "Готово. Успішно: $ok, помилок: $fail"
echo "Тепер перезавантаж сторінку (Ctrl+Shift+R) — «Текст → криві» має працювати."
