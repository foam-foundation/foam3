#!/usr/bin/env bash
# Remove a secret key from the keystore.

if [ "$#" -ne 2 ]; then
    echo "usage: $0 domain alias"
    exit 1
fi

set -e
DOMAIN=$1
ALIAS=$2
PASSWORD=$DOMAIN
export KEYTOOL_STOREPASS="$PASSWORD"

# Set Name variables
DNAME="
CN=$DOMAIN
OU=R&D
O=$DOMAIN
L=Toronto
S=ON
C=CA
"

echo "keytool delete secret key from encryption"

keytool -delete \
 -v \
 -alias "$ALIAS" \
 -keystore "$DOMAIN.jks" \
 -storepass:env KEYTOOL_STOREPASS \
 -storetype PKCS12 

echo -e "Success!"
echo

# Retrieval
# KeyStore ks = KeyStore.getInstance("JCEKS");
# ks.load(new FileInputStream(new File("KEYSTORE_FILE")), "KEYSTORE_PAS# SWORD".toCharArray());

# SecretKey passwordKey = (SecretKey) ks.getKey("ALIAS", "KEY_PASSWORD".toCharArray());

# System.out.println(new String(passwordKey.getEncoded()));
