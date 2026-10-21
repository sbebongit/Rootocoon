"""
Starts Rootocoon over HTTPS.

    python run.py              ->  https://localhost:8443

The first time, a self-signed TLS certificate is created in the certs/ folder.
The browser then warns "your connection is not private", because no known
authority has signed the certificate - click "Advanced -> Proceed".
The traffic is still encrypted. A real public website would use a free
certificate from Let's Encrypt instead.
"""
import datetime
import ipaddress
import sys
from pathlib import Path

import uvicorn

ROOT = Path(__file__).resolve().parent
CERT = ROOT / "certs" / "cert.pem"
KEY = ROOT / "certs" / "key.pem"
PORT = 8443


def make_cert():
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import NameOID

    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(minutes=5))
        .not_valid_after(now + datetime.timedelta(days=365))
        .add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
            ]),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )
    CERT.parent.mkdir(exist_ok=True)
    KEY.write_bytes(key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ))
    CERT.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    print("Created a TLS certificate in certs/")


if __name__ == "__main__":
    if not (CERT.exists() and KEY.exists()):
        make_cert()
    sys.path.insert(0, str(ROOT / "server"))
    print(f"\n  Open  https://localhost:{PORT}\n")
    uvicorn.run(
        "app:app",
        app_dir=str(ROOT / "server"),
        host="127.0.0.1",          # only reachable from this computer ("0.0.0.0" = whole network)
        port=PORT,
        ssl_certfile=str(CERT),
        ssl_keyfile=str(KEY),
        access_log=False,          # no logs of who uploaded what
        server_header=False,       # don't tell visitors which server software we run
        proxy_headers=False,       # don't trust forwarded-IP headers, they can be faked
    )
