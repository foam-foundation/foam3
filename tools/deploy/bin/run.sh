#!/bin/bash
# Super simple launcher.

HOST_NAME=`hostname -s`
APP_HOME=
APP_ROOT=/opt
APP_NAME=
WEB_PORT=
export DEBUG=0
export DEBUG_SUSPEND=n
export DEBUG_PORT=8000
PROFILER=0
PROFILER_PORT=8849
CLUSTER=false
VERSION=

function usage {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options are:"
    echo "  -d                  : Debug enabled"
    echo "  -D port             : Debug enabled, on port (default 8000)"
    echo "  -H hostname         : Hostname override"
    echo "  -m                  : Confiugure as Medusa mediator"
    echo "  -N name             : Application name"
    echo "  -P port             : Profiling enabled on PORT"
    echo "  -p                  : Profiling enabled, default 8849"
    echo "  -R path             : Application root path, default /opt"
    echo "  -s                  : Debug enabled, suspend on launch"
    echo "  -W port             : HTTP Port (defaults to http:8080 | https:8443)"
    echo "  -V version          : Version"
}

# NOTE this run script is used for both local and remote jvm execution.
# When used locally, the build.js arguments c (clean) and r (restart) are
# handled as the script is often passed all parameters from build.js.
# Similarly m and C are support for Medusa mediator configuration
while getopts "A:D:dH:mN:P:pR:sW:V:" opt ; do
    case $opt in
        A) APP_HOME=${OPTARG};;
        D) DEBUG=1;
           if [ -n "${OPTARG}" ]; then
               DEBUG_PORT=${OPTARG};
           fi;;
        d) DEBUG=1;;
        H) HOST_NAME=${OPTARG};;
        m) CLUSTER=true;;
        N) APP_NAME=${OPTARG};;
        P) PROFILER=1;
           PROFILER_PORT=${OPTARG};;
        p) PROFILER=1;;
        R) APP_ROOT=${OPTARG};;
        s) DEBUG=1;
           DEBUG_SUSPEND=y;;
        W) if [ -n ${OPTARG} ] && [ ${OPTARG} -ne 0 ]; then
               WEB_PORT=${OPTARG}
           fi;;
        V) VERSION=${OPTARG};;
        ?) usage ; exit 0 ;;
   esac
done

if [ -z "${APP_HOME}" ]; then
    if [ -z "${APP_NAME}" ]; then
        echo "usage: $0 either APP_NAME or APP_HOME required"
        exit 1;
    fi
    APP_HOME="/${APP_ROOT}/${APP_NAME}"
fi

echo "starting $APP_NAME @ $HOST_NAME:$WEB_PORT"

if [[ -z "${JAVA_OPTS}" ]]; then
    JAVA_OPTS=""
fi

export JOURNAL_HOME="${APP_HOME}/journals"
export DOCUMENT_HOME="${APP_HOME}/documents"
export LOG_HOME="${APP_HOME}/logs"

# load instance specific deployment options
if [ -f "${APP_HOME}/etc/shrc.local" ]; then
    . "${APP_HOME}/etc/shrc.local"
fi

JAVA_OPTS="${JAVA_OPTS} -DAPP_HOME=${APP_HOME}"
JAVA_OPTS="${JAVA_OPTS} -Dresource.journals.dir=journals"
JAVA_OPTS="${JAVA_OPTS} -Dhostname=${HOST_NAME}"
if [ -z "`echo "${JAVA_OPTS}" | grep "http.port"`" ] && [ ! -z ${WEB_PORT} ]; then
    JAVA_OPTS="${JAVA_OPTS} -Dhttp.port=${WEB_PORT}"
fi
JAVA_OPTS="${JAVA_OPTS} -DJOURNAL_HOME=${JOURNAL_HOME}"
JAVA_OPTS="${JAVA_OPTS} -DDOCUMENT_HOME=${DOCUMENT_HOME}"
JAVA_OPTS="${JAVA_OPTS} -DLOG_HOME=${LOG_HOME}"

if [[ "$PROFILER" -eq 1 ]]; then
    JAVA_OPTS="${JAVA_OPTS} -agentpath:${PROFILER_AGENT_PATH}=port=$PROFILER_PORT"
fi

if [[ ${JAVA_OPTS} != *"CLUSTER"* ]]; then
    if [[ ${CLUSTER} = "true" ]]; then
        JAVA_OPTS="${JAVA_OPTS} -DCLUSTER=${CLUSTER}"
    fi
fi

# Binary JAR contains compiled .class files
BIN_JAR=$(ls ${APP_HOME}/lib/${APP_NAME}-${VERSION}.jar 2>/dev/null | awk '{print $1}')
# Resources JAR contains journals, documents, images, webroot
RES_JAR=$(ls ${APP_HOME}/lib/${APP_NAME}-resources-${VERSION}.jar 2>/dev/null | awk '{print $1}')

# Set RES_JAR_HOME to point to the resources JAR for ResourceStorage
JAVA_OPTS="${JAVA_OPTS} -DRES_JAR_HOME=${RES_JAR}"

export JAVA_TOOL_OPTIONS="${JAVA_OPTS}"
echo ${JAVA_OPTS} > ${APP_HOME}/logs/opts.txt

# Get main class from the manifest
MAIN_CLASS=$(unzip -p "${BIN_JAR}" META-INF/MANIFEST.MF | grep "Main-Class:" | awk '{print $2}' | tr -d '\r')

# Launch using classpath with both JARs and library dependencies
java -server -cp "${BIN_JAR}:${RES_JAR}:${APP_HOME}/lib/*" ${MAIN_CLASS}

exit 0
