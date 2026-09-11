# Runs {App} in a container.
#
# Build:  docker build -t {app} .
# Run:    docker run --rm -p 8080:8080 -v {app}-journals:/opt/{app}/journals {app}
#
# Journals, logs and documents live under /opt/{app} and are declared as
# volumes so data survives the container. The heap defaults to 75% of the
# container memory (conf/shrc.custom); set JAVA_OPTS to override, e.g.
#   docker run -e JAVA_OPTS="-Xms4g -Xmx4g" ...
#
# Dockerfile.vercel shares the builder stage; keep the two in step.

# Stage 1: build the binary and resources JARs and package them as tarballs.
FROM eclipse-temurin:21 AS builder

RUN apt-get update \
 && apt-get install -y --no-install-recommends git nodejs npm maven \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# A checkout made without --recursive, or a copy of the repository such as the
# one the Vercel Deploy button creates, has no foam3/ content. Fetch the branch
# named in .gitmodules in that case.
RUN [ -f foam3/pom.js ] || git clone --depth 1 \
      -b "$(git config -f .gitmodules submodule.foam3.branch)" \
      "$(git config -f .gitmodules submodule.foam3.url)" foam3
RUN cd foam3 && npm install

RUN ./build.sh -Jdocker --build-docker-tar \
 && ./build.sh -Jdocker --build-resources-tar \
 && grep -m1 "version:" pom.js | sed "s/.*'\(.*\)'.*/\1/" > build/package/VERSION

# Stage 2: runtime. JDK rather than JRE: foam.core.script.Script runs JShell
# in-process and needs jdk.jshell and jdk.compiler.
FROM eclipse-temurin:21

RUN apt-get update \
 && apt-get install -y --no-install-recommends unzip \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/build/package/ /tmp/package/
RUN mkdir -p /tmp/extract \
 && for t in /tmp/package/*.tar.gz; do tar -xzf "$t" -C /tmp/extract; done \
 && /tmp/extract/bin/install-docker.sh -A /opt/{app} -E /tmp/extract -N {app} -V "$(cat /tmp/package/VERSION)" \
 && cp /tmp/package/VERSION /opt/{app}/VERSION \
 && mkdir -p /opt/{app}/journals /opt/{app}/documents /opt/{app}/logs \
 && rm -rf /tmp/extract /tmp/package

VOLUME ["/opt/{app}/journals", "/opt/{app}/documents", "/opt/{app}/logs"]

ENV WEB_PORT=8080
EXPOSE 8080

WORKDIR /opt/{app}
CMD ["bash", "-c", "exec bin/run-docker.sh -A /opt/{app} -N {app} -V \"$(cat VERSION)\" -W \"${WEB_PORT}\""]
