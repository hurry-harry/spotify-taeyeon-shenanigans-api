require("dotenv").config();

const express = require("express");
const app = express();

var request = require("request");
var cors = require("cors");
var queryString = require("querystring");
var cookieParser = require("cookie-parser");

app.use(cors()).use(cookieParser());

app.get("/", (req, res) => {
    res.send("<h1>Hello, Express.js Server!</h1>");
});

const port = process.env.PORT || 8888;
app.listen(port, () => {
    console.log(`Server is running on Port ${port}`);
});

var generateRandomString = function (length) {
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const values = crypto.getRandomValues(new Uint8Array(length));

    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};

app.get("/login", (req, res) => {
    const state = generateRandomString(16);
    res.cookie(process.env.STATE_KEY, state);

    const scopes = "user-top-read";

    res.redirect(process.env.AUTH_URL +
        queryString.stringify({
            response_type: "code",
            client_id: process.env.CLIENT_ID,
            scope: scopes,
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
                grant_type: "authorization_code",
                code: code,
                redirect_uri: process.env.REDIRECT_URI
            },
            headers: {
                Authorization:
                    "Basic " +
                    new Buffer.from(process.env.CLIENT_ID + ":" + process.env.CLIENT_SECRET).toString("base64"),
            },
            json: true
        };

        request.post(authOptions, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                var access_token = body.access_token;
                var refresh_token = body.refresh_token;

                // redirects back to browser frontend
                res.redirect(process.env.BASE_PATH + "/?authorized=true#" + access_token);
            } else {
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