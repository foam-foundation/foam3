#!/bin/bash
#
# Docker-specific installation script for FOAM applications.
# Designed for use in Dockerfile RUN commands.
#
# This script is simplified compared to install.sh:
# - No systemd service setup (containers don't use systemd)
# - No user/group creation (handled by Dockerfile)
# - No /mnt directory structure or symlinks
# - Simple file copy to target directory
# - Minimal permissions setup
# - Non-interactive execution
#
# Usage in Dockerfile:
#   COPY app.tar.gz /tmp/
#   RUN tar -xzf /tmp/app.tar.gz -C /tmp/extract && \
#       /tmp/extract/bin/install-docker.sh -A /app -N myapp -V 1.0.0
#

APP_NAME=
APP_HOME=/app
VERSION=
EXTRACT_DIR=/tmp/tar_extract
WEB_PORT=8080

function info {
    echo "INFO :: $@"
}

function error {
    echo "ERROR :: $@" >&2
}

function usage {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -A app-home     : Application deployment directory (default: /app)"
    echo "  -E extract-dir  : Directory where docker tarball was extracted (default: /tmp/tar_extract)"
    echo "  -N app-name     : Application name (required)"
    echo "  -V version      : Application version (required)"
    echo "  -W port         : Web server port (default: 8080)"
    echo ""
    echo "Example:"
    echo "  $0 -A /app -N myapp -V 1.0.0 -W 8080"
}

while getopts "A:E:N:V:W:h" opt ; do
    case $opt in
        A) APP_HOME=${OPTARG};;
        E) EXTRACT_DIR=${OPTARG};;
        N) APP_NAME=${OPTARG};;
        V) VERSION=${OPTARG};;
        W) WEB_PORT=${OPTARG};;
        h) usage; exit 0;;
        ?) usage; exit 1;;
    esac
done

# Validate required parameters
if [ -z "${APP_NAME}" ]; then
    error "APP_NAME is required (-N)"
    usage
    exit 1
fi

if [ -z "${VERSION}" ]; then
    error "VERSION is required (-V)"
    usage
    exit 1
fi

info "Installing ${APP_NAME} v${VERSION} to ${APP_HOME}"

# Create application directories (runtime dirs like journals, logs, documents are mounted as volumes)
mkdir -p ${APP_HOME}/lib
mkdir -p ${APP_HOME}/bin
mkdir -p ${APP_HOME}/etc
mkdir -p ${APP_HOME}/conf

# Copy library files (JARs) from docker tarball
if [ -d "${EXTRACT_DIR}/lib" ]; then
    cp -r ${EXTRACT_DIR}/lib/* ${APP_HOME}/lib/
    info "Installed library files to ${APP_HOME}/lib"
else
    error "No lib directory found in ${EXTRACT_DIR}"
    exit 1
fi

# Copy bin files (scripts)
if [ -d "${EXTRACT_DIR}/bin" ]; then
    cp -r ${EXTRACT_DIR}/bin/* ${APP_HOME}/bin/
    chmod +x ${APP_HOME}/bin/*.sh 2>/dev/null || true
    info "Installed bin files to ${APP_HOME}/bin"
fi

# Copy etc files (configuration)
if [ -d "${EXTRACT_DIR}/etc" ]; then
    cp -r ${EXTRACT_DIR}/etc/* ${APP_HOME}/etc/
    info "Installed configuration files to ${APP_HOME}/etc"
fi

# Create default shrc.custom in conf directory if it doesn't exist
if [ ! -f "${APP_HOME}/conf/shrc.custom" ]; then
    echo '#!/bin/bash' > ${APP_HOME}/conf/shrc.custom
    echo 'JAVA_OPTS="${JAVA_OPTS} -Xmx4096m"' >> ${APP_HOME}/conf/shrc.custom
    info "Created default ${APP_HOME}/conf/shrc.custom"
fi

# Set basic permissions (container user should have access)
chmod -R 755 ${APP_HOME}/bin 2>/dev/null || true
chmod -R 644 ${APP_HOME}/lib/*.jar 2>/dev/null || true
chmod -R 755 ${APP_HOME}/conf 2>/dev/null || true

info "Installation complete"
info "  APP_HOME: ${APP_HOME}"
info "  Binary JAR: ${APP_HOME}/lib/${APP_NAME}-${VERSION}.jar"
info "  WEB_PORT: ${WEB_PORT}"

exit 0
