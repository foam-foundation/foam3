#!/bin/bash
node foam3/tools/build.js "$@"

if [[ $? -eq 1 ]]; then
    tput bel;
fi
