#!/bin/bash
# Docker-specific run script for FOAM applications.
# Designed for use in Docker containers where JAR versions may differ from runtime VERSION.
#
# Key differences from run.sh:
# - Finds JARs by pattern match instead of exact version
# - Simplified options for container environment
# - No systemd/service dependencies

# Ensure Java is in PATH (eclipse-temurin image location)
export PATH="/opt/java/openjdk/bin:${PATH}"

HOST_NAME=$(hostname -s)
APP_HOME=
APP_NAME=
WEB_PORT=8080
VERSION=

function usage {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -A app-home     : Application home directory"
    echo "  -H hostname     : Hostname override"
    echo "  -N app-name     : Application name"
    echo "  -V version      : Version (for display only)"
    echo "  -W port         : HTTP Port (default: 8080)"
}

while getopts "A:H:N:V:W:h" opt ; do
    case $opt in
        A) APP_HOME=${OPTARG};;
        H) HOST_NAME=${OPTARG};;
        N) APP_NAME=${OPTARG};;
        V) VERSION=${OPTARG};;
        W) WEB_PORT=${OPTARG};;
        h) usage; exit 0;;
        ?) usage; exit 1;;
    esac
done

if [ -z "${APP_HOME}" ]; then
    echo "ERROR: APP_HOME is required (-A)"
    exit 1
fi

if [ -z "${APP_NAME}" ]; then
    echo "ERROR: APP_NAME is required (-N)"
    exit 1
fi

echo "starting ${APP_NAME} @ ${HOST_NAME}:${WEB_PORT}"

# Set up paths
export JOURNAL_HOME="${APP_HOME}/journals"
export DOCUMENT_HOME="${APP_HOME}/documents"
export LOG_HOME="${APP_HOME}/logs"

# Load instance specific deployment options
if [ -f "${APP_HOME}/conf/shrc.custom" ]; then
    . "${APP_HOME}/conf/shrc.custom"
fi

if [ -f "${APP_HOME}/etc/shrc.local" ]; then
    . "${APP_HOME}/etc/shrc.local"
fi

# Initialize JAVA_OPTS if not set
if [ -z "${JAVA_OPTS}" ]; then
    JAVA_OPTS=""
fi

JAVA_OPTS="${JAVA_OPTS} -DAPP_HOME=${APP_HOME}"
JAVA_OPTS="${JAVA_OPTS} -Dresource.journals.dir=journals"
JAVA_OPTS="${JAVA_OPTS} -Dhostname=${HOST_NAME}"
JAVA_OPTS="${JAVA_OPTS} -Dhttp.port=${WEB_PORT}"
JAVA_OPTS="${JAVA_OPTS} -DJOURNAL_HOME=${JOURNAL_HOME}"
JAVA_OPTS="${JAVA_OPTS} -DDOCUMENT_HOME=${DOCUMENT_HOME}"
JAVA_OPTS="${JAVA_OPTS} -DLOG_HOME=${LOG_HOME}"

# Find Binary JAR (contains compiled .class files)
# Pattern: ${APP_NAME}-*.jar but NOT ${APP_NAME}-resources-*.jar
BIN_JAR=$(ls ${APP_HOME}/lib/${APP_NAME}-[0-9]*.jar 2>/dev/null | grep -v resources | head -1)

if [ -z "${BIN_JAR}" ]; then
    echo "ERROR: Binary JAR not found in ${APP_HOME}/lib/"
    echo "Expected pattern: ${APP_NAME}-*.jar"
    ls -la ${APP_HOME}/lib/ 2>/dev/null
    exit 1
fi

echo "Using binary JAR: ${BIN_JAR}"

# Find Resources JAR (contains journals, documents, images, webroot)
# Pattern: ${APP_NAME}-resources-*.jar
RES_JAR=$(ls ${APP_HOME}/lib/${APP_NAME}-resources-*.jar 2>/dev/null | head -1)

if [ -n "${RES_JAR}" ]; then
    echo "Using resources JAR: ${RES_JAR}"
    JAVA_OPTS="${JAVA_OPTS} -DRES_JAR_HOME=${RES_JAR}"
else
    echo "No resources JAR found (optional)"
    JAVA_OPTS="${JAVA_OPTS} -DRES_JAR_HOME="
fi

export JAVA_TOOL_OPTIONS="${JAVA_OPTS}"

# Save opts for debugging
mkdir -p ${LOG_HOME}
echo ${JAVA_OPTS} > ${LOG_HOME}/opts.txt

# Get main class from the manifest
MAIN_CLASS=$(unzip -p "${BIN_JAR}" META-INF/MANIFEST.MF | grep "Main-Class:" | awk '{print $2}' | tr -d '\r')

if [ -z "${MAIN_CLASS}" ]; then
    echo "ERROR: Could not find Main-Class in ${BIN_JAR} manifest"
    exit 1
fi

echo "Main class: ${MAIN_CLASS}"

# Launch using classpath with all JARs in lib directory
# In Docker, both binary and resources JARs are in lib/
java -server -cp "${APP_HOME}/lib/*" ${MAIN_CLASS}

exit $?
