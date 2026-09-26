# Anti-Inflation

A simple multilingual anti-inflation tracker for monitoring product prices and unit costs.

## Unicode language support
The page is configured for multilingual Unicode rendering using fonts such as:
- Arabic
- Hebrew
- Devanagari
- Japanese
- Chinese (Simplified / Traditional)
- Latin-based languages

## PostgreSQL setup
A PostgreSQL-ready schema is included in the `database/` directory.

### Start PostgreSQL locally with Docker
```bash
docker compose up -d
```

### Run the web app
```bash
python3 -m http.server 8000
```

Then open: http://localhost:8000