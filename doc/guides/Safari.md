# Safari Debugging with HTTPS

Safari has strict SSL/TLS certificate requirements that prevent it from connecting to localhost servers using plain HTTP or untrusted HTTPS certificates. To debug FOAM applications in Safari, you must build with HTTPS enabled.

## Build Command

```bash
./build.sh -ca -J../foam3/deployment/https
```

### Flags Explained
- `-c`: Clean generated code
- `-a`: Run from Java JAR file (required for HTTPS)
- `-J../foam3/deployment/https`: Include the HTTPS journal with SSL certificates

## Access URL

After building, access your application at:

```
https://localhost:8443
```

## Why This Is Required

1. **Safari enforces strict SSL policies** - It cannot connect to `https://localhost:8443` when the server expects HTTPS
2. **Self-signed certificates** - Safari requires proper SSL handshake even for localhost development
3. **The `-a` flag is mandatory** - HTTPS support requires running from the JAR file

## Alternative: Use Chrome or Firefox

Chrome and Firefox are more lenient with self-signed certificates during development. They will show a warning but allow you to proceed:
- Click "Advanced"
- Click "Proceed to localhost (unsafe)"

## Troubleshooting

### "cannot parse response" Error
This occurs when Safari tries to connect via HTTP to an HTTPS port, or vice versa. Ensure:
1. You built with the https journal (`-J../foam3/deployment/https`)
2. You're using `https://` not `http://` in the URL
3. The server is running (check terminal output)

### Certificate Not Trusted
If Safari still refuses to connect, you may need to trust the certificate in macOS Keychain:

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain foam3/deployment/https/foamdev-ca.crt
```

Then quit and reopen Safari.
