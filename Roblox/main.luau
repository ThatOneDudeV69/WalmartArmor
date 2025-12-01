local bit = bit32

-- hashing

local K = {
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
}
local function add32(a, b)
    return (a + b) % 0x100000000
end

local function add32_4(a, b, c, d)
    return add32(add32(add32(a, b), c), d)
end

local function add32_5(a, b, c, d, e)
    return add32(add32_4(a, b, c, d), e)
end

local function tohex(n)
    local hex = "0123456789abcdef"
    local out = ""
    for i = 28, 0, -4 do
        local d = bit.rshift(n, i) % 16
        out = out .. hex:sub(d + 1, d + 1)
    end
    return out
end

local function sha256(msg)
    local ml = #msg * 8
    msg = msg .. "\128"
    while (#msg % 64) ~= 56 do
        msg = msg .. "\0"
    end
    for i = 7, 0, -1 do
        msg = msg .. string.char(math.floor(ml / 2 ^ (8 * i)) % 256)
    end

    local h0, h1, h2, h3 = 0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a
    local h4, h5, h6, h7 = 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19

    local w = {}

    for chunk = 1, #msg, 64 do
        for i = 0, 15 do
            local o = chunk + i * 4
            w[i] = msg:byte(o) * 16777216 + msg:byte(o + 1) * 65536 + msg:byte(o + 2) * 256 + msg:byte(o + 3)
        end

        for i = 16, 63 do
            local s0 = bit.bxor(bit.rrotate(w[i - 15], 7), bit.rrotate(w[i - 15], 18), bit.rshift(w[i - 15], 3))
            local s1 = bit.bxor(bit.rrotate(w[i - 2], 17), bit.rrotate(w[i - 2], 19), bit.rshift(w[i - 2], 10))
            w[i] = add32_4(w[i - 16], s0, w[i - 7], s1)
        end

        local a, b, c, d, e, f, g, h = h0, h1, h2, h3, h4, h5, h6, h7

        for i = 0, 63 do
            local S1 = bit.bxor(bit.rrotate(e, 6), bit.rrotate(e, 11), bit.rrotate(e, 25))
            local ch = bit.bxor(bit.band(e, f), bit.band(bit.bnot(e), g))
            local temp1 = add32_5(h, S1, ch, K[i + 1], w[i])
            local S0 = bit.bxor(bit.rrotate(a, 2), bit.rrotate(a, 13), bit.rrotate(a, 22))
            local maj = bit.bxor(bit.band(a, b), bit.band(a, c), bit.band(b, c))
            local temp2 = add32(S0, maj)

            h = g
            g = f
            f = e
            e = add32(d, temp1)
            d = c
            c = b
            b = a
            a = add32(temp1, temp2)
        end

        h0 = add32(h0, a)
        h1 = add32(h1, b)
        h2 = add32(h2, c)
        h3 = add32(h3, d)
        h4 = add32(h4, e)
        h5 = add32(h5, f)
        h6 = add32(h6, g)
        h7 = add32(h7, h)
    end

    return tohex(h0) .. tohex(h1) .. tohex(h2) .. tohex(h3) .. tohex(h4) .. tohex(h5) .. tohex(h6) .. tohex(h7)
end

local decode_json = function(json) 
    return game:GetService("HttpService"):JSONDecode(json)
end

-- rng

local drbg_state = sha256(tostring({}) .. tostring(sha256) .. tostring(os.clock()) .. tostring(math.random()))

local function get_entropy()
    return tostring({}) .. tostring(get_entropy) .. tostring(os.clock()) .. tostring(tick()) .. tostring(math.random()) .. drbg_state
end

local function update_state()
    drbg_state = sha256(drbg_state .. get_entropy())
end

local generate_nonce = function()
    local length = 16
    update_state()
    local chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    local out = {}
    for i = 1, length do
        drbg_state = sha256(drbg_state)
        local v = tonumber(string.sub(drbg_state,1,2),16)
        local idx = (v % #chars) + 1
        out[i] = string.sub(chars, idx, idx)
    end
    return table.concat(out)
end

-- shared secrets
local secret1 = ""
local secret2 = ""
local secret3 = ""

-- server url. guide and source code is in repo
local server_sync_endpoint = ""
local key_check_endpoint = ""

local request = request or http_request or (syn and syn.request) or http.request

local get_time = function()
    
    local res = request({
        Method = "GET",
        Url = server_sync_endpoint
    })

    if not res or not res.Body then
        return nil
    end

    if res.StatusCode ~= 200 then
        return nil
    end

    local unix = tonumber(res.Body)
    if not unix then
        return nil
    end

    return unix
end


local validate_key = function(key)
    if not key then
        return false, "KEY_INVALID"
    end

    local server_time = get_time()
    if not server_time then
        return false, "SERVER_DOWN"
    end

    local now = os.time()
    local offset = server_time - now
    local synced_time = now + offset

    local nonce = generate_nonce()
    
    local signature = sha256(
        nonce        .. secret1 ..
        key          .. secret2 ..
        synced_time  .. secret3
    )

    local res = request({
        Method = "GET",
        Url = key_check_endpoint,
        Headers = {
            ["Content-Type"]   = "application/json",
            ["clienttime"]     = synced_time,
            ["clientnonce"]    = nonce,
            ["clientkey"]      = key,
            ["externalsignature"] = signature
        }
    })
    
    if not res or not res.Body then
        return false, "SERVER_DOWN"
    end
    
    local key_data = decode_json(res.Body)
    if not key_data.code then
        return false
    end
    
    if key_data.code == "KEY_VALID" then
        local server_signature = key_data.signature
        
        if not server_signature then
            return false, "SIGNATURE_UNKNOWN"
        end
        
        local expected_signature = sha256(
          nonce       .. secret3 ..
          key_data.code .. synced_time
        )
        
        if server_signature == expected_signature then
            return true, key_data.data
        else
            return false, "SECURITY_ERROR"
        end
    else
        return false, key_data.code
    end
end
