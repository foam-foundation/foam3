# Installation
## Linux / Chromebook / WSL
Install git, java, maven, npm, nvm, and nodejs, if required. On Linux, you can do this with:

    sudo apt install git
    sudo apt install openjdk-21-jdk
    sudo apt install maven
    sudo apt install npm

    # steps for nodejs (requires version 16 or greater, ubuntu currently defaults to 12)
    sudo apt install curl
    curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash
    source ~/.bashrc
    nvm install --lts

## MacOS
Install brew, git, java, maven, nvm, and nodejs, if required.

Install Brew (with directions from [https://brew.sh/](https://brew.sh/)):

    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    echo >> ~/.zprofile
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"

Install the Node Version Manager (NVM):

    brew upgrade
    brew install nvm
    echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
    echo '[ -s "$(brew --prefix nvm)/nvm.sh" ] && \. "$(brew --prefix nvm)/nvm.sh"' >> ~/.zshrc
    echo '[ -s "$(brew --prefix nvm)/etc/bash_completion.d/nvm" ] && \. "$(brew --prefix nvm)/etc/bash_completion.d/nvm"' >> ~/.zshrc
    source ~/.zshrc

Install NodeJS

    nvm install 22

Install Java

    brew install java
    echo 'export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"' >> ~/.zshrc

Install Maven

    brew install maven

# Environment

Setup /opt Directory

    sudo chown -R $USER /opt

# FOAM
Git Clone

    git clone https://github.com/kgrgreer/foam3.git

# Application
Create an example application

    ./build.sh -TStandard,setup/Project --appName:example --package:com.foamdev --adminPassword:badpassword

Build and Start Server

    cd ..
    ./build.sh deployment/demo/run.sh

Connect to Server

  [http://localhost:8080/](http://localhost:8080/) 

Login to Server

  - demo user - username: demo, password: demopassword
  - admin user - username: admin, password: badpassword
