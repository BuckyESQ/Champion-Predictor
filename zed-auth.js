        class ZedAuthManager {
            constructor() {
                this.tokenKey = 'zedTrackerAuthToken';
                this.tokenExpiryKey = 'zedTrackerAuthTokenExpiry';
                this.refreshing = false;
            }

            /**
             * Parses JWT token to extract payload
             */
            parseJwt(token) {
                if (!token) return null;
                try {
                    const parts = token.split('.');
                    if (parts.length < 2) return null;
                    const base64Url = parts[1];
                    const base64    = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const jsonPayload = decodeURIComponent(
                        atob(base64)
                        .split('')
                        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                        .join('')
                    );
                    return JSON.parse(jsonPayload);
                } catch (e) {
                    console.error("Error parsing JWT:", e);
                    return null;
                }
            }

            /**Checks if the token is expired
             */
            isTokenExpired(token) {
                if (!token) return true;
                const payload = this.parseJwt(token);
                if (!payload?.exp) return true;
                return payload.exp < Math.floor(Date.now() / 1000);
            }

            /**
             * Gets token expiry details
             */
            getTokenExpiry() {
                const expiryStr = localStorage.getItem(this.tokenExpiryKey);
                if (!expiryStr) return null;
                const expiryDate = new Date(expiryStr);
                const remaining  = Math.max(0, expiryDate.getTime() - Date.now());
                return {
                    date: expiryDate,
                    remaining,
                    expired: this.isTokenExpired(localStorage.getItem(this.tokenKey))
                };
            }

            /**
             * Formats remaining time in a human-readable format
             */
            formatRemainingTime(remaining) {
                if (remaining <= 0) return "Expired";
                const hours   = Math.floor(remaining / (1000 * 60 * 60));
                const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            }

            /**
             * Sets the auth token and stores it securely.
             */
            setToken(token) {
                try {
                    if (!token) return false;
                    const payload = this.parseJwt(token);
                    if (!payload?.exp) return false;
                    localStorage.setItem(this.tokenKey, token);
                    const expiryDate = new Date(payload.exp * 1000);
                    if (isNaN(expiryDate)) return false;
                    localStorage.setItem(this.tokenExpiryKey, expiryDate.toISOString());
                    return true;
                } catch (e) {
                    console.error("Error setting token:", e);
                    return false;
                }
            }

            /**
             * Gets the stored auth token
             */
            getToken() {
                return localStorage.getItem(this.tokenKey);
            }
        }  // ← end class

        // Create global instance
        window.zedAuth = new ZedAuthManager();