#!/bin/bash
#
# Starts {App} inside the Vercel container.
#
# Dockerfile.vercel installs the JARs under /opt/{app} with install-docker.sh.
# On Vercel only /tmp is writable, so the application home run-docker.sh
# expects is assembled there on every cold start: the installed bin, etc, lib
# and conf directories are linked in, and journals, documents and logs are
# fresh directories. Runtime data therefore starts from the seed journals in
# the resources JAR on each cold start.
set -e

INSTALL_HOME=/opt/{app}
APP_HOME=/tmp/{app}

mkdir -p "${APP_HOME}/journals" "${APP_HOME}/documents" "${APP_HOME}/logs"
for d in bin etc lib conf; do
  ln -sfn "${INSTALL_HOME}/${d}" "${APP_HOME}/${d}"
done

# install-docker.sh seeds conf/shrc.custom with a 75% initial and maximum heap,
# which commits 1.5 GB of the 2 GB a Vercel Hobby function has. An explicit
# -Xms/-Xmx in JAVA_OPTS takes precedence in run-docker.sh; set JAVA_OPTS in
# the Vercel project settings to size the heap differently.
export JAVA_OPTS="${JAVA_OPTS:--Xms256m -Xmx1200m}"

# Vercel spreads requests over several instances that share no memory, so a
# login on one instance is unknown to the next. SESSION_DEFAULT_USER (set in
# Dockerfile.vercel) signs every new session in as that user instead; unset
# it in the Vercel project settings to get the login page.
if [ -n "${SESSION_DEFAULT_USER}" ]; then
  JAVA_OPTS="${JAVA_OPTS} -Dsession.defaultUser=${SESSION_DEFAULT_USER}"
fi

exec "${INSTALL_HOME}/bin/run-docker.sh" \
  -A "${APP_HOME}" \
  -N {app} \
  -V "$(cat "${INSTALL_HOME}/VERSION")" \
  -W "${PORT:-80}"
