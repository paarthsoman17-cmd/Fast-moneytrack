// Standalone RFC 6238 TOTP implementation. It does not use an email, SMS,
// authenticator MFA provider, or third-party OTP service.
const MoneyTrackTotp = (() => {
    const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    function randomBytes(length) {
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        return bytes;
    }

    function toBase32(bytes) {
        let bits = "";
        bytes.forEach(byte => {
            bits += byte.toString(2).padStart(8, "0");
        });

        let output = "";
        for (let offset = 0; offset < bits.length; offset += 5) {
            const chunk = bits.slice(offset, offset + 5).padEnd(5, "0");
            output += BASE32_ALPHABET[parseInt(chunk, 2)];
        }
        return output;
    }

    function fromBase32(secret) {
        const normalized = String(secret).toUpperCase().replace(/[^A-Z2-7]/g, "");
        let bits = "";
        for (const character of normalized) {
            bits += BASE32_ALPHABET.indexOf(character).toString(2).padStart(5, "0");
        }

        const bytes = [];
        for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
            bytes.push(parseInt(bits.slice(offset, offset + 8), 2));
        }
        return new Uint8Array(bytes);
    }

    function createSecret(length = 20) {
        return toBase32(randomBytes(length)).replace(/.{4}(?=.)/g, "$& ");
    }

    function storageKey(userId) {
        return `moneytrack-totp-${userId}`;
    }

    function getSecret(userId) {
        return localStorage.getItem(storageKey(userId)) || "";
    }

    function isEnabled(userId) {
        return Boolean(getSecret(userId));
    }

    function enable(userId, secret) {
        localStorage.setItem(storageKey(userId), String(secret).replace(/\s/g, ""));
    }

    function disable(userId) {
        localStorage.removeItem(storageKey(userId));
    }

    function hotp(secret, counter) {
        const bytes = new ArrayBuffer(8);
        const view = new DataView(bytes);
        view.setUint32(4, counter >>> 0);
        view.setUint32(0, Math.floor(counter / 0x100000000) >>> 0);

        return crypto.subtle.importKey(
            "raw",
            fromBase32(secret),
            { name: "HMAC", hash: "SHA-1" },
            false,
            ["sign"]
        ).then(async key => {
            const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes));
            const offset = digest[digest.length - 1] & 0xf;
            const value =
                ((digest[offset] & 0x7f) << 24) |
                ((digest[offset + 1] & 0xff) << 16) |
                ((digest[offset + 2] & 0xff) << 8) |
                (digest[offset + 3] & 0xff);
            return String(value % 1000000).padStart(6, "0");
        });
    }

    async function generate(secret, timestamp = Date.now()) {
        const counter = Math.floor(timestamp / 30000);
        return hotp(secret, counter);
    }

    async function verify(secret, code, timestamp = Date.now()) {
        const counter = Math.floor(timestamp / 30000);
        const normalized = String(code).trim().replace(/\s/g, "");
        if (!/^\d{6}$/.test(normalized)) {
            return false;
        }

        for (const step of [-1, 0, 1]) {
            if ((await hotp(secret, counter + step)) === normalized) {
                return true;
            }
        }
        return false;
    }

    function provisioningUri(secret, accountName, issuer = "MoneyTrack") {
        const params = new URLSearchParams({
            secret: secret.replace(/\s/g, ""),
            issuer,
            algorithm: "SHA1",
            digits: "6",
            period: "30"
        });
        return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?${params}`;
    }

    return {
        createSecret,
        enable,
        disable,
        getSecret,
        isEnabled,
        generate,
        verify,
        provisioningUri
    };
})();
