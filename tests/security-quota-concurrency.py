"""Optional real-PostgreSQL concurrency regression; never connects to Supabase.
Run in an isolated venv with pgserver and psycopg[binary] installed.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import mkdtemp
from threading import Barrier
import time
import pgserver
import psycopg

server = pgserver.get_server(mkdtemp(prefix='quota-regression-'), cleanup_mode='delete')
try:
    uri = server.get_uri()
    with psycopg.connect(uri, autocommit=True) as db:
        # Same minimal relational contract used by the PGlite tests.
        source = Path(__file__).with_name('security-quotas.mjs').read_text()
        db.execute(source.split('await db.exec(`', 1)[1].split('`)', 1)[0])
        db.execute((Path(__file__).parents[1] / 'supabase/migrations/012_limites_publicacion_en_bd.sql').read_text())
        uid = db.execute('INSERT INTO perfiles DEFAULT VALUES RETURNING id').fetchone()[0]
        ids = [db.execute('INSERT INTO inmuebles(usuario_id) VALUES(%s) RETURNING id', (uid,)).fetchone()[0] for _ in range(2)]

        def race(sql, params):
            barrier = Barrier(3)
            def writer():
                with psycopg.connect(uri, autocommit=True, application_name='quota-race') as conn:
                    barrier.wait(timeout=10)
                    try:
                        conn.execute(sql, params)
                        return 'ok'
                    except psycopg.Error as error:
                        return error.sqlstate
            # Hold the shared quota lock until BOTH independent connections are blocked.
            db.execute('BEGIN')
            db.execute('SELECT id FROM perfiles WHERE id=%s FOR UPDATE', (uid,))
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(writer) for _ in range(2)]
                barrier.wait(timeout=10)
                deadline = time.monotonic() + 10
                waiting = 0
                while time.monotonic() < deadline:
                    waiting = db.execute("SELECT count(*) FROM pg_stat_activity WHERE application_name='quota-race' AND wait_event_type='Lock'").fetchone()[0]
                    if waiting == 2:
                        break
                    time.sleep(0.01)
                db.execute('COMMIT')
                results = [f.result(timeout=10) for f in futures]
            assert waiting == 2, 'Test did not exercise overlapping transactions'
            assert sorted(results) == ['23514', 'ok'], results

        race('INSERT INTO inmuebles(usuario_id) VALUES(%s)', (uid,))
        assert db.execute('SELECT count(*) FROM inmuebles WHERE usuario_id=%s AND activo', (uid,)).fetchone()[0] == 3
        for _ in range(7):
            db.execute('INSERT INTO inmueble_imagenes(inmueble_id) VALUES(%s)', (ids[0],))
        race('INSERT INTO inmueble_imagenes(inmueble_id) VALUES(%s)', (ids[0],))
        assert db.execute('SELECT count(*) FROM inmueble_imagenes WHERE inmueble_id=%s', (ids[0],)).fetchone()[0] == 8
        print('PASS: two independent concurrent PostgreSQL writers cannot exceed the last listing or photo slot.')
finally:
    server.cleanup()
