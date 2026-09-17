"""Explicit migration/seed commands; never run against the old prototype DB."""
import argparse
from pathlib import Path
from dotenv import load_dotenv
from persistence.store import ROOT, Store


def main():
    load_dotenv(ROOT / '.env')
    p = argparse.ArgumentParser()
    p.add_argument('action', choices=['migrate','seed','verify'])
    p.add_argument('--confirm-mvp-database', action='store_true', required=True)
    args = p.parse_args()
    store = Store()
    if args.action == 'verify':
        from persistence.verification import verify
        print(verify(store))
        return
    if not store.url:
        raise SystemExit('Set DATABASE_URL in backend/.env to a dedicated MVP PostGIS database first.')
    if args.action == 'migrate':
        with store.connect() as c:
            c.execute((ROOT/'migrations'/'001_foundation.sql').read_text(encoding='utf-8'))
            c.execute((ROOT/'migrations'/'002_review_audit.sql').read_text(encoding='utf-8'))
        print('Foundation and review/audit schema applied.')
    else:
        from services.sources import demo_sources
        if store.sources():
            raise SystemExit('Sources already exist; refusing to overwrite them.')
        store.seed(demo_sources())
        print('Synthetic sources seeded.')



if __name__ == '__main__':
    main()
