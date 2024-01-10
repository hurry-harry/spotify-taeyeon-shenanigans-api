require("dotenv").config();

const { createHash } = require("crypto");
const express = require("express");
const app = express();

var request = require("request");
var cors = require("cors");
var queryString = require("querystring");
var cookieParser = require("cookie-parser");

var code_verifier_test_1 = "";
var code_verifier_test_2 = "";

app.use(cors()).use(cookieParser());

app.get("/", (req, res) => {
    res.send("<h1>Hello, Express.js Server!</h1>");
});

const port = process.env.PORT || 8888;
app.listen(port, () => {
    console.log(`Server is running on Port ${port}`);
});

app.get("/test", (req, res) => {
    res.send("<h1>Login Requested</h1>");
    console.log("login");
});

var generateRandomString = function (length) {
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const values = crypto.getRandomValues(new Uint8Array(length));

    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};

// const codeVerifier = generateRandomString(64);
const randomString = generateRandomString(64);

var hashAndEncode = function (toHash) {
    return Buffer.from(createHash("sha256").update(toHash).digest("hex")).toString("base64");
};

var hashAndEncode2 = function (toHash) {
    // const hashed = createHash("sha256").update(toHash).digest("base64url");

    // console.log("hash", hashed);

    // // encode to Base64url
    // const encoded = btoa(String.fromCharCode.apply(null, new Uint8Array(hashed))
    //     .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));

    // console.log("encoded", encoded);

    // return hashed;

    const encoder = new TextEncoder();
    const data = encoder.encode(toHash);
    const hashed1 = createHash("sha256").update(data).digest("base64url");
    const hashed2 = createHash("sha256").update(data).digest("hex");

    console.log("hash test 1", hashed1);
    console.log("hash test 2", hashed2);
    
    return hashed2;
}

app.get("/login", (req, res) => {
    const state = generateRandomString(16);
    res.cookie(process.env.STATE_KEY, state);

    console.log('randomString codeVerifier init', randomString);
    code_verifier_test_1 = hashAndEncode(randomString);
    code_verifier_test_2 = hashAndEncode2(randomString);
    const scopes = "user-top-read";

    console.log("hashedAndEncoded1", code_verifier_test_1);
    console.log("hashedAndEncoded2", code_verifier_test_2);

    res.redirect(process.env.AUTH_URL +
        queryString.stringify({
            response_type: "code",
            client_id: process.env.CLIENT_ID,
            scope: scopes,
            code_challenge_method: "S256",
            code_challenge: code_verifier_test_2,
            redirect_uri: process.env.REDIRECT_URI,
            state: state
        }));
});

app.get("/callback/", (req, res) => {
    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[process.env.STATE_KEY] : null;

    if (state === null || state !== storedState) {
        // if state does not match, error
        res.redirect(
            "/#" +
            queryString.stringify({
                error: "state_mismatch",
            })
        );
    } else {
        res.clearCookie(process.env.STATE_KEY);

        var authOptions = {
            url: "https://accounts.spotify.com/api/token",
            form: {
                client_id: process.env.CLIENT_ID,
                grant_type: "authorization_code",
                code: code,
                redirect_uri: process.env.REDIRECT_URI,
                code_verifier: code_verifier_test_2
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            json: true
        };

        console.log('codeVerifier', authOptions.form.code_verifier);

        request.post(authOptions, function (error, response, body) {
            console.log('response', response.statusCode);
            console.log('body', body);
            if (!error && response.statusCode === 200) {
                console.log('success');
                var access_token = body.access_token;
                var refresh_token = body.refresh_token;

                // redirects back to browser frontend
                res.redirect(process.env.BASE_PATH + "/?authorized=true#" + access_token);
            } else {
                console.log('fail');
                res.redirect(
                    process.env.BASE_PATH +
                    "/?" +
                    queryString.stringify({
                        error: "invalid_token#error",
                    })
                );
            }
        });
    }
})