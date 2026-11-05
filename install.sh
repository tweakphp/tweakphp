#!/usr/bin/env bash
set -euo pipefail

# This script relies on bash features (RETURN traps, ${var//} expansion).
# If started by a real POSIX sh (e.g. dash), hand over to bash.
if [ -z "${BASH_VERSION:-}" ]; then
    if [ -f "$0" ]; then
        exec bash "$0" "$@"
    fi
    echo "This installer requires bash. Run it with: bash install.sh" >&2
    exit 1
fi

APP="TweakPHP"
REPO="tweakphp/tweakphp"
DOWNLOAD_BASE="https://github.com/${REPO}/releases/download"
LATEST_BASE="https://github.com/${REPO}/releases/latest/download"
ICON_URL="https://raw.githubusercontent.com/${REPO}/main/build/icon.png"

MUTED='\033[0;2m'
RED='\033[0;31m'
ORANGE='\033[38;5;214m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Install prefix used by the AppImage fallback method on Linux.
LINUX_PREFIX="/opt/tweakphp"

requested_version=""
force_appimage=false
no_desktop=false
do_uninstall=false

# Global install state (populated while resolving a release).
SUDO=""
meta_channel="latest"
meta_file=""
ASSET_BASE=""
release_version=""
tmp_dir=""

usage() {
    cat <<EOF
TweakPHP Installer

Usage: install.sh [options]

Options:
    -h, --help            Display this help message
    -v, --version <ver>   Install a specific version (e.g. 0.14.1 or v0.14.1)
    -a, --appimage        Force the AppImage install method on Linux (default:
                          the native .deb/.rpm package is used when available)
        --no-desktop      Skip the desktop entry and icon (Linux AppImage only)
    -u, --uninstall       Remove TweakPHP

Examples:
    curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash
    ./install.sh --version 0.14.1
    ./install.sh --appimage
    ./install.sh --uninstall
EOF
}

print_message() {
    local message="$1"
    printf '%b\n' "$message"
}

die() {
    printf '%b\n' "${RED}Error: $1${NC}" >&2
    exit 1
}

warn() {
    printf '%b\n' "${ORANGE}Warning: $1${NC}" >&2
}

# Resolve a privileged command prefix: empty when running as root, "sudo" otherwise.
ensure_sudo() {
    if [ "$(id -u)" = "0" ]; then
        SUDO=""
    elif command -v sudo >/dev/null 2>&1; then
        SUDO="sudo"
    else
        die "Root privileges are required for this step. Run the installer as root or install sudo."
    fi
}

sha512_of() {
    if command -v sha512sum >/dev/null 2>&1; then
        sha512sum "$1" | awk '{print $1}'
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 512 "$1" | awk '{print $1}'
    elif command -v openssl >/dev/null 2>&1; then
        openssl dgst -sha512 -r "$1" | awk '{print $1}'
    else
        die "No SHA-512 tool found (sha512sum, shasum or openssl is required)."
    fi
}

yml_version() {
    awk '/^version:/ { print $2; exit }' "$1"
}

# Print the sha512 recorded in an electron-builder metadata file for a given asset name.
yml_sha() {
    awk -v want="$2" '
        /^ *- url:/   { have = ($3 == want); next }
        have && /^ +sha512:/ { print $2; exit }
    ' "$1"
}

# Download the electron-builder metadata file for a release ("latest" or "vX.Y.Z").
# Sets: meta_channel, meta_file, ASSET_BASE, release_version.
get_meta() {
    local yml_name="$1"
    meta_channel="latest"
    if [ -n "$requested_version" ]; then
        meta_channel="v${requested_version#v}"
    fi

    if [ "$meta_channel" = "latest" ]; then
        ASSET_BASE="$LATEST_BASE"
        meta_url="$LATEST_BASE/$yml_name"
    else
        ASSET_BASE="$DOWNLOAD_BASE/$meta_channel"
        meta_url="$ASSET_BASE/$yml_name"
    fi

    meta_file="$tmp_dir/$yml_name"
    if ! curl -fsSL -o "$meta_file" "$meta_url"; then
        die "Could not fetch release metadata ($meta_url). Check the requested version and the available releases at https://github.com/${REPO}/releases"
    fi

    release_version=$(yml_version "$meta_file")
    if [ -z "$release_version" ]; then
        die "Release metadata at $meta_url is malformed (missing version)."
    fi
}

print_progress() {
    local bytes="$1"
    local length="$2"
    [ "$length" -gt 0 ] || return 0

    local width=50
    local percent=$((bytes * 100 / length))
    [ "$percent" -gt 100 ] && percent=100
    local on=$((percent * width / 100))
    local off=$((width - on))

    local filled
    filled=$(printf "%*s" "$on" "")
    filled=${filled// /#}
    local empty
    empty=$(printf "%*s" "$off" "")
    empty=${empty// /-}

    printf "\r${ORANGE}[%s%s] %3d%%${NC}" "$filled" "$empty" "$percent" >&4
}

download_with_progress() {
    local url="$1"
    local output="$2"
    local headers="${output}.headers"

    if [ -t 2 ]; then
        exec 4>&2
    else
        exec 4>/dev/null
    fi

    # Hide the cursor while the bar is rendered.
    printf "\033[?25l" >&4

    curl -fsL -D "$headers" -o "$output" "$url" &
    local curl_pid=$!
    local ret=0
    local length bytes

    # Poll the file size on a timer so the rendering cost stays constant.
    # shellcheck disable=SC2012
    while kill -0 "$curl_pid" 2>/dev/null; do
        if [ -f "$output" ]; then
            length=$(grep -i '^content-length:' "$headers" 2>/dev/null | tail -n 1 | tr -dc '0-9' || true)
            # shellcheck disable=SC2012
            bytes=$(ls -ln "$output" | awk '{print $5}')
            print_progress "$bytes" "${length:-0}"
        fi
        sleep 0.1 2>/dev/null || sleep 1
    done

    wait "$curl_pid" || ret=$?
    if [ "$ret" -eq 0 ]; then
        # shellcheck disable=SC2012
        bytes=$(ls -ln "$output" | awk '{print $5}')
        print_progress "$bytes" "$bytes"
    fi
    echo "" >&4

    # Cleanup before returning (no RETURN trap: its firing order differs
    # across bash versions and POSIX sh mode, closing fd 4 too early).
    rm -f "$headers"
    printf "\033[?25h" >&4
    exec 4>&-
    return "$ret"
}

download() {
    local url="$1"
    local output="$2"

    if [ -t 2 ]; then
        download_with_progress "$url" "$output" || die "Could not download $url"
    else
        curl -fsSL -o "$output" "$url" || die "Could not download $url"
    fi
}

# Decode a base64 string to its hexadecimal representation (electron-builder
# stores checksums as base64, while sha512sum/shasum print hex).
b64_to_hex() {
    local decoded=""
    if command -v openssl >/dev/null 2>&1; then
        decoded=$(printf '%s' "$1" | openssl base64 -d -A 2>/dev/null) || decoded=""
    elif printf 'aGk=' | base64 -d 2>/dev/null | grep -q hi; then
        decoded=$(printf '%s' "$1" | base64 -d)
    else
        decoded=$(printf '%s' "$1" | base64 -D)
    fi
    # od -v avoids collapsing repeated lines with '*'.
    printf '%s' "$decoded" | od -An -v -tx1 | tr -d ' \n'
}

verify_checksum() {
    local file="$1"
    local expected="$2"
    local actual expected_hex
    actual=$(sha512_of "$file")
    expected_hex=$(b64_to_hex "$expected")
    if [ -z "$expected_hex" ] || [ "$actual" != "$expected_hex" ]; then
        die "Checksum verification failed for $(basename "$file")."
    fi
    print_message "${MUTED}Checksum OK: ${NC}$(basename "$file")"
}

# Download an asset referenced by the metadata file and verify it.
# $1: asset file name as listed in the metadata, $2: destination path.
fetch_asset() {
    local file_name="$1"
    local output="$2"
    local expected_sha
    expected_sha=$(yml_sha "$meta_file" "$file_name")
    if [ -z "$expected_sha" ]; then
        return 1
    fi

    print_message "${MUTED}Downloading ${NC}$APP $release_version ${MUTED}(${file_name})${NC}"
    download "$ASSET_BASE/$file_name" "$output"
    verify_checksum "$output" "$expected_sha"
}

install_mac() {
    get_meta "latest-mac.yml"

    local file_name="TweakPHP-${release_version}-universal-mac.zip"
    local app_dir="$tmp_dir/app"
    mkdir -p "$app_dir"

    if ! fetch_asset "$file_name" "$tmp_dir/$file_name"; then
        die "The universal macOS package is missing from release $release_version metadata."
    fi

    print_message "${MUTED}Extracting ${NC}$APP.app..."
    if ! ditto -x -k "$tmp_dir/$file_name" "$app_dir"; then
        die "Could not extract the downloaded archive."
    fi
    if [ ! -d "$app_dir/$APP.app" ]; then
        die "The downloaded archive did not contain $APP.app."
    fi

    if [ ! -w "/Applications" ]; then
        ensure_sudo
    fi
    if command -v pgrep >/dev/null 2>&1 && pgrep -xq "$APP"; then
        warn "$APP appears to be running. Close it and relaunch after the install completes."
    fi
    if [ -e "/Applications/$APP.app" ]; then
        print_message "${MUTED}Removing previous version from /Applications...${NC}"
        $SUDO rm -rf "/Applications/$APP.app"
    fi
    if ! $SUDO mv "$app_dir/$APP.app" "/Applications/$APP.app"; then
        die "Could not move $APP.app to /Applications."
    fi

    print_message ""
    print_message "${GREEN}$APP $release_version installed to /Applications.${NC}"
    print_message "${MUTED}Launch it from the Applications folder or with:${NC} open -a $APP"
}

detect_pm() {
    if command -v apt-get >/dev/null 2>&1; then
        echo "apt"
    elif command -v dnf >/dev/null 2>&1; then
        echo "dnf"
    elif command -v zypper >/dev/null 2>&1; then
        echo "zypper"
    elif command -v yum >/dev/null 2>&1; then
        echo "yum"
    else
        echo ""
    fi
}

install_linux_deb() {
    local file_name="tweakphp_${release_version}_amd64.deb"
    if ! fetch_asset "$file_name" "$tmp_dir/$file_name"; then
        return 1
    fi

    ensure_sudo
    print_message "${MUTED}Installing the .deb package with apt...${NC}"
    if ! $SUDO apt-get install -y "$tmp_dir/$file_name"; then
        print_message "${MUTED}apt could not resolve the package directly, falling back to dpkg...${NC}"
        $SUDO dpkg -i "$tmp_dir/$file_name" || true
        $SUDO apt-get install -y --fix-broken
    fi

    print_message ""
    print_message "${GREEN}$APP $release_version installed.${NC}"
    print_message "${MUTED}Launch it from your application menu.${NC}"
}

install_linux_rpm() {
    local file_name="tweakphp-${release_version}.x86_64.rpm"
    if ! fetch_asset "$file_name" "$tmp_dir/$file_name"; then
        return 1
    fi

    local pm
    pm=$(detect_pm)
    ensure_sudo
    print_message "${MUTED}Installing the .rpm package with $pm...${NC}"
    case "$pm" in
        dnf) $SUDO dnf install -y "$tmp_dir/$file_name" ;;
        yum) $SUDO yum localinstall -y "$tmp_dir/$file_name" ;;
        zypper) $SUDO zypper --non-interactive install --allow-unsigned-rpm "$tmp_dir/$file_name" ;;
    esac

    print_message ""
    print_message "${GREEN}$APP $release_version installed.${NC}"
    print_message "${MUTED}Launch it from your application menu.${NC}"
}

install_linux_appimage() {
    local file_name="TweakPHP-${release_version}.AppImage"
    if [ "$(uname -m)" != "x86_64" ]; then
        file_name="TweakPHP-${release_version}-arm64.AppImage"
    fi
    if ! fetch_asset "$file_name" "$tmp_dir/$file_name"; then
        die "The AppImage package is missing from release $release_version metadata."
    fi

    ensure_sudo
    print_message "${MUTED}Installing to ${NC}$LINUX_PREFIX..."
    $SUDO mkdir -p "$LINUX_PREFIX"
    $SUDO mv -f "$tmp_dir/$file_name" "$LINUX_PREFIX/tweakphp.AppImage"
    $SUDO chmod 755 "$LINUX_PREFIX/tweakphp.AppImage"

    local target="$LINUX_PREFIX/tweakphp.AppImage"
    if ! ldconfig -p 2>/dev/null | grep -q "libfuse.so.2"; then
        print_message "${MUTED}libfuse2 not found, extracting the AppImage so it runs without FUSE...${NC}"
        # The AppImage runtime links against the unversioned libz.so, which is only
        # shipped by the zlib dev package. Symlink the versioned library into a
        # private directory and use it just for the extraction step.
        local libz_src=""
        libz_src=$(ldconfig -p 2>/dev/null | awk '$1 == "libz.so.1" { print $NF; exit }')
        local extract_prefix=""
        if [ -n "$libz_src" ]; then
            $SUDO mkdir -p "$LINUX_PREFIX/lib"
            $SUDO ln -sfn "$libz_src" "$LINUX_PREFIX/lib/libz.so"
            extract_prefix="$LINUX_PREFIX/lib"
        fi
        # set -e must not abort the script here; the AppRun check below reports errors.
        $SUDO env LD_LIBRARY_PATH="$extract_prefix" sh -c "cd '$LINUX_PREFIX' && ./tweakphp.AppImage --appimage-extract >/dev/null" || true
        if [ ! -x "$LINUX_PREFIX/squashfs-root/AppRun" ]; then
            die "AppImage extraction failed. Install libfuse2 (e.g. sudo apt install libfuse2t64) and retry."
        fi
        target="$LINUX_PREFIX/squashfs-root/AppRun"
    fi

    $SUDO mkdir -p /usr/local/bin
    $SUDO ln -sfn "$target" /usr/local/bin/tweakphp

    if [ "$no_desktop" != "true" ]; then
        $SUDO mkdir -p /usr/share/applications /usr/share/pixmaps
        if ! $SUDO curl -fsSL -o /usr/share/pixmaps/tweakphp.png "$ICON_URL"; then
            warn "Could not download the application icon, the menu entry will use a generic icon."
        fi

        local desktop_file="[Desktop Entry]
Name=$APP
Comment=Tweak your PHP code easily
Exec=$target
Terminal=false
Type=Application
Icon=tweakphp
Categories=Development;
StartupWMClass=$APP"
        printf '%s\n' "$desktop_file" | $SUDO tee /usr/share/applications/tweakphp.desktop >/dev/null

        if command -v update-desktop-database >/dev/null 2>&1; then
            $SUDO update-desktop-database /usr/share/applications 2>/dev/null || true
        fi
    fi

    print_message ""
    print_message "${GREEN}$APP $release_version installed to $LINUX_PREFIX.${NC}"
    print_message "${MUTED}Launch it from your application menu, or run:${NC} tweakphp"
}

install_linux() {
    local arch
    case "$(uname -m)" in
        x86_64) arch="x64" ;;
        aarch64 | arm64) arch="arm64" ;;
        *)
            die "Unsupported architecture: $(uname -m). Supported: x86_64, aarch64."
            ;;
    esac

    local yml_name="latest-linux.yml"
    if [ "$arch" = "arm64" ]; then
        # The x64 metadata file also carries the .deb and .rpm assets.
        yml_name="latest-linux-arm64.yml"
    fi
    get_meta "$yml_name"

    print_message "${MUTED}Detected platform: ${NC}Linux $arch"

    local mode="appimage"
    if [ "$force_appimage" != "true" ] && [ "$arch" = "x64" ]; then
        local pm
        pm=$(detect_pm)
        case "$pm" in
            apt) mode="deb" ;;
            dnf | yum | zypper) mode="rpm" ;;
        esac
    fi

    if [ "$mode" = "deb" ] && install_linux_deb; then
        return
    elif [ "$mode" = "deb" ]; then
        print_message "${ORANGE}No .deb package in this release, falling back to AppImage.${NC}"
        mode="appimage"
    fi

    if [ "$mode" = "rpm" ] && install_linux_rpm; then
        return
    elif [ "$mode" = "rpm" ]; then
        print_message "${ORANGE}No .rpm package in this release, falling back to AppImage.${NC}"
        mode="appimage"
    fi

    install_linux_appimage
}

uninstall_mac() {
    if [ -e "/Applications/$APP.app" ]; then
        if [ ! -w "/Applications" ]; then
            ensure_sudo
        fi
        $SUDO rm -rf "/Applications/$APP.app"
        print_message "${GREEN}$APP removed from /Applications.${NC}"
    else
        print_message "$APP was not found in /Applications."
    fi
}

uninstall_linux() {
    local removed=false

    if command -v dpkg-query >/dev/null 2>&1 && \
        [ "$(dpkg-query -W -f='${Status}' tweakphp 2>/dev/null || true)" = "install ok installed" ]; then
        ensure_sudo
        $SUDO apt-get remove -y tweakphp
        removed=true
    elif command -v rpm >/dev/null 2>&1 && rpm -q tweakphp >/dev/null 2>&1; then
        ensure_sudo
        if command -v dnf >/dev/null 2>&1; then
            $SUDO dnf remove -y tweakphp
        elif command -v yum >/dev/null 2>&1; then
            $SUDO yum remove -y tweakphp
        elif command -v zypper >/dev/null 2>&1; then
            $SUDO zypper --non-interactive remove tweakphp
        fi
        removed=true
    fi

    if [ -e "$LINUX_PREFIX" ]; then
        ensure_sudo
        $SUDO rm -rf "$LINUX_PREFIX"
        $SUDO rm -f /usr/local/bin/tweakphp
        removed=true
    fi

    if [ -e /usr/share/applications/tweakphp.desktop ]; then
        ensure_sudo
        $SUDO rm -f /usr/share/applications/tweakphp.desktop
        removed=true
    fi
    if [ -e /usr/share/pixmaps/tweakphp.png ]; then
        ensure_sudo
        $SUDO rm -f /usr/share/pixmaps/tweakphp.png
        removed=true
    fi

    if [ "$removed" != "true" ]; then
        print_message "$APP was not found on this system."
    else
        print_message "${GREEN}$APP has been uninstalled.${NC}"
    fi
}

print_banner() {
    # Single-quoted (not a heredoc): bash 3.2 mis-parses backticks in heredocs inside $().
    # Generated with: figlet -f standard TweakPHP
    local art='  _____                    _    ____  _   _ ____
 |_   _|_      _____  __ _| | _|  _ \| | | |  _ \
   | | \ \ /\ / / _ \/ _` | |/ / |_) | |_| | |_) |
   | |  \ V  V /  __/ (_| |   <|  __/|  _  |  __/
   |_|   \_/\_/ \___|\__,_|_|\_\_|   |_| |_|_|'
    echo ""
    printf '%b\n' "${MUTED}${art}${NC}"
    echo ""
}

while [ $# -gt 0 ]; do
    case "$1" in
        -h | --help)
            usage
            exit 0
            ;;
        -v | --version)
            if [ -n "${2:-}" ]; then
                requested_version="$2"
                shift
            else
                die "--version requires a version argument, e.g. --version 0.14.1"
            fi
            ;;
        -a | --appimage)
            force_appimage=true
            ;;
        --no-desktop)
            no_desktop=true
            ;;
        -u | --uninstall)
            do_uninstall=true
            ;;
        *)
            die "Unknown option: $1 (see --help)"
            ;;
    esac
    shift
done

case "$(uname -s)" in
    Darwin*) os="darwin" ;;
    Linux*) os="linux" ;;
    MINGW* | MSYS* | CYGWIN*)
        die "This script does not support Windows. Download the .exe installer from https://github.com/${REPO}/releases"
        ;;
    *)
        die "Unsupported operating system: $(uname -s). Supported: macOS, Linux."
        ;;
esac

if [ -n "$requested_version" ]; then
    requested_version="${requested_version#v}"
    case "$requested_version" in
        *[!0-9.]*)
            die "Invalid version: $requested_version (expected e.g. 0.14.1)"
            ;;
    esac
fi

if [ "$do_uninstall" = "true" ]; then
    if [ "$os" = "darwin" ]; then
        uninstall_mac
    else
        uninstall_linux
    fi
    exit 0
fi

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/tweakphp_install.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT

print_message "${MUTED}Installing ${NC}$APP"
if [ -n "$requested_version" ]; then
    print_message "${MUTED}Requested version: ${NC}$requested_version"
else
    print_message "${MUTED}Resolving latest stable release...${NC}"
fi

if [ "$os" = "darwin" ]; then
    install_mac
else
    install_linux
fi

print_banner
print_message "${MUTED}The app keeps itself up to date. For more information visit ${NC}https://tweakphp.com"
print_message ""
