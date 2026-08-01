FROM php:8.3-cli

# Install system dependencies & PHP extensions required for Laravel, SQLite, SSH, and Composer
RUN apt-get update && apt-get install -y \
    sqlite3 \
    libsqlite3-dev \
    libzip-dev \
    zip \
    unzip \
    git \
    openssh-server \
    && docker-php-ext-install pdo_sqlite zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Pre-install Composer binary into /usr/local/bin/composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
