# Lexicon Source Files

Lucia's Dictionary builds the public core lexicon from two external source files.
Keep these files local unless the project explicitly decides to vendor them.

## high-frequency-vocabulary

Source repo: <https://github.com/arstgit/high-frequency-vocabulary>

Place a ranked word file here:

```text
tools/lexicon-sources/high-frequency-vocabulary/30k.txt
```

The build script uses the first token on each line and keeps the top 15000 ranked words as candidates.

## ECDICT

Source repo: <https://github.com/skywind3000/ECDICT>

Place the CSV file here:

```text
tools/lexicon-sources/ecdict/ecdict.csv
```

The build script reads Chinese translations, phonetics, POS data, and exchange/forms from this file.

## Commit Policy

Do not commit huge temporary source files if they are too large for the app repo. The generated public file is committed instead:

```text
public/assets/lexicon/core-lexicon.json
```
