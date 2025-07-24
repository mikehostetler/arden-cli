import { describe, expect, it } from 'bun:test';

import { sanitize, sanitizeForDebug, sanitizeForJson } from '../sanitize';

describe('sanitize utility', () => {
  describe('sensitive key detection', () => {
    it('should mask fields containing "token"', () => {
      const input = {
        api_token: 'abcd1234efgh5678',
        access_token: 'xyz789',
        authToken: 'very-long-token-value-here',
        normal_field: 'safe_value',
      };

      const result = sanitize(input);

      expect(result.api_token).toBe('abcd********5678');
      expect(result.access_token).toBe('[REDACTED]');
      expect(result.authToken).toBe('very******************here');
      expect(result.normal_field).toBe('safe_value');
    });

    it('should mask fields containing "secret"', () => {
      const input = {
        client_secret: 'secret123456789',
        API_SECRET: 'top-secret-value',
        secretKey: 'short',
        public_data: 'visible',
      };

      const result = sanitize(input);

      expect(result.client_secret).toBe('secr*******6789');
      expect(result.API_SECRET).toBe('top-********alue');
      expect(result.secretKey).toBe('[REDACTED]');
      expect(result.public_data).toBe('visible');
    });

    it('should mask fields containing other sensitive patterns', () => {
      const input = {
        password: 'mypassword123',
        api_key: 'key_abcdef123456',
        auth_header: 'Bearer token123',
        credentials: 'user:pass@host',
        user_id: 12345, // not sensitive
      };

      const result = sanitize(input);

      expect(result.password).toBe('mypa*****d123');
      expect(result.api_key).toBe('key_********3456');
      expect(result.auth_header).toBe('Bear*******n123');
      expect(result.credentials).toBe('user******host');
      expect(result.user_id).toBe(12345);
    });
  });

  describe('data type handling', () => {
    it('should handle null and undefined', () => {
      expect(sanitize(null)).toBe(null);
      expect(sanitize(undefined)).toBe(undefined);
    });

    it('should handle primitives', () => {
      expect(sanitize('string')).toBe('string');
      expect(sanitize(123)).toBe(123);
      expect(sanitize(true)).toBe(true);
      expect(sanitize(false)).toBe(false);
    });

    it('should handle arrays', () => {
      const input = [
        'safe_value',
        { token: 'secret123456789', data: 'public' },
        { nested: { api_key: 'key123456789' } },
      ];

      const result = sanitize(input);

      expect(result[0]).toBe('safe_value');
      expect(result[1].token).toBe('secr*******6789');
      expect(result[1].data).toBe('public');
      expect(result[2].nested.api_key).toBe('key1****6789');
    });

    it('should handle built-in objects', () => {
      const date = new Date('2023-01-01');
      const regex = /test/;
      const error = new Error('test error');

      expect(sanitize(date)).toBe(date);
      expect(sanitize(regex)).toBe(regex);
      expect(sanitize(error)).toBe(error);
    });
  });

  describe('nested object sanitization', () => {
    it('should sanitize deeply nested objects', () => {
      const input = {
        user: {
          id: 123,
          profile: {
            name: 'John Doe',
            settings: {
              api_token: 'deep-secret-token-value',
              theme: 'dark',
            },
          },
        },
        auth: {
          access_token: 'top-level-token',
          refresh_token: 'refresh123',
        },
      };

      const result = sanitize(input);

      expect(result.user.id).toBe(123);
      expect(result.user.profile.name).toBe('John Doe');
      expect(result.user.profile.settings.api_token).toBe('deep***************alue');
      expect(result.user.profile.settings.theme).toBe('dark');
      expect(result.auth.access_token).toBe('top-*******oken');
      expect(result.auth.refresh_token).toBe('refr**h123');
    });

    it('should handle circular references gracefully', () => {
      const input: any = { name: 'test', token: 'secret123456789' };
      input.self = input; // Create circular reference

      // Should not throw an error and should handle circular refs
      const result = sanitize(input);
      expect(result.name).toBe('test');
      expect(result.token).toBe('secr*******6789');
      expect(result.self).toBe('[CIRCULAR]');
    });
  });

  describe('masking logic', () => {
    it('should mask long strings appropriately', () => {
      const longToken = 'abcdefghijklmnopqrstuvwxyz123456789';
      const result = sanitize({ token: longToken });

      expect(result.token).toBe('abcd***************************6789');
      expect(result.token.length).toBe(longToken.length);
    });

    it('should redact short strings', () => {
      const shortTokens = ['a', 'ab', 'abc', 'abcd', 'abcde', 'abcdef', 'abcdefg', 'abcdefgh'];

      shortTokens.forEach(token => {
        const result = sanitize({ secret: token });
        expect(result.secret).toBe('[REDACTED]');
      });
    });

    it('should handle non-string sensitive values', () => {
      const input = {
        token_number: 123456,
        secret_boolean: true,
        api_key_null: null,
        key_object: { nested: 'value' },
      };

      const result = sanitize(input);

      expect(result.token_number).toBe('[REDACTED]');
      expect(result.secret_boolean).toBe('[REDACTED]');
      expect(result.api_key_null).toBe('[REDACTED]');
      expect(result.key_object).toBe('[REDACTED]');
    });
  });

  describe('wrapper functions', () => {
    it('sanitizeForJson should work same as sanitize', () => {
      const input = { token: 'secret123456789', data: 'public' };

      expect(sanitizeForJson(input)).toEqual(sanitize(input));
    });

    it('sanitizeForDebug should work same as sanitize', () => {
      const input = { api_key: 'key123456789', user: 'john' };

      expect(sanitizeForDebug(input)).toEqual(sanitize(input));
    });
  });

  describe('real-world scenarios', () => {
    it('should sanitize API response with tokens', () => {
      const apiResponse = {
        status: 'success',
        data: {
          user_id: 12345,
          username: 'johndoe',
          access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
          refresh_token: 'rt_abcdef123456',
          profile: {
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
        metadata: {
          api_key: 'ak_production_123456789',
          timestamp: '2023-01-01T00:00:00Z',
        },
      };

      const result = sanitize(apiResponse);

      expect(result.status).toBe('success');
      expect(result.data.user_id).toBe(12345);
      expect(result.data.username).toBe('johndoe');
      expect(result.data.access_token).toBe('eyJh****************************VCJ9');
      expect(result.data.refresh_token).toBe('rt_a*******3456');
      expect(result.data.profile.name).toBe('John Doe');
      expect(result.data.profile.email).toBe('john@example.com');
      expect(result.metadata.api_key).toBe('ak_p***************6789');
      expect(result.metadata.timestamp).toBe('2023-01-01T00:00:00Z');
    });

    it('should sanitize config objects', () => {
      const config = {
        host: 'api.example.com',
        port: 443,
        auth: {
          client_id: 'public_client_id', // client_id is not sensitive (no match for patterns)
          client_secret: 'very_secret_client_secret_value',
          api_token: 'prod_token_123456789',
        },
        features: {
          debug: true,
          telemetry: false,
        },
      };

      const result = sanitize(config);

      expect(result.host).toBe('api.example.com');
      expect(result.port).toBe(443);
      expect(result.auth.client_id).toBe('public_client_id'); // not sensitive - doesn't match patterns
      expect(result.auth.client_secret).toBe('very***********************alue');
      expect(result.auth.api_token).toBe('prod************6789');
      expect(result.features.debug).toBe(true);
      expect(result.features.telemetry).toBe(false);
    });
  });
});
