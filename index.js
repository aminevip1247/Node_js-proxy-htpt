const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Initialize Stripe without proxy first (will be re-initialized with proxy when needed)
const stripe = require('stripe')('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');

const app = express();

// Configuration
const PORT = 4242;
const STRIPE_PUBLISHABLE_KEY = "pk_live_51Q1nXPDITUpEwoAydNEuJchYyo9BD6CZ46PWtQWTiSFWx78BQKhkO1mTz7Ej6kvQ3zN9BNIOIYJl3bHlDB0QkK3400exTxSAFx";
const ADMIN_CREDENTIALS = {
    'amine': 'x3x'
};

// Proxy configuration
const PROXIES = [
    "118.193.58.115:2333:u85179d1a579505d3-zone-custom-region-eu:u85179d1a579505d3",
    "schro.quantumproxies.net:1111:Quantum-ihdv4ue1:GWfgeFToibCrMOCOoXLs"
];

let currentProxyIndex = 0;

function getProxyAgent() {
    if (PROXIES.length === 0) return null;
    
    const proxyStr = PROXIES[currentProxyIndex];
    const [host, port, username, password] = proxyStr.split(':');
    
    const proxyUrl = `http://${username}:${password}@${host}:${port}`;
    return new HttpsProxyAgent(proxyUrl);
}

function rotateProxy() {
    currentProxyIndex = (currentProxyIndex + 1) % PROXIES.length;
    console.log(`Rotated to proxy ${currentProxyIndex + 1}/${PROXIES.length}: ${PROXIES[currentProxyIndex]}`);
}

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: '1GH650339',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    if (!req.session.loggedIn) {
        return res.redirect('/login');
    }
    res.send(`
<!doctype html>
<html>
<head>
    <title>Donate $1</title>
    <script src="https://js.stripe.com/v3/"></script>
    <style>
        body { font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; }
        .form-row { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; }
        .StripeElement { padding: 10px; border: 1px solid #ccc; border-radius: 4px; }
        #submit-btn { 
            background-color: #4CAF50; 
            color: white; 
            padding: 10px 15px; 
            border: none; 
            cursor: pointer;
            position: relative;
        }
        #submit-btn .spinner {
            display: none;
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s ease-in-out infinite;
        }
        #submit-btn.loading {
            color: transparent;
        }
        #submit-btn.loading .spinner {
            display: block;
        }
        @keyframes spin {
            to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        #error-message { color: red; margin-top: 10px; }
    </style>
</head>
<body>
    <h1>Donate $1</h1>
    <form id="payment-form">
        <div class="form-row">
            <label for="card-number">Card Number</label>
            <div id="card-number" class="StripeElement"></div>
        </div>
        <div class="form-row">
            <label for="card-cvc">CVC</label>
            <div id="card-cvc" class="StripeElement"></div>
        </div>
        <div class="form-row">
            <label for="card-exp">Expiration (MM/YY)</label>
            <div id="card-exp" class="StripeElement"></div>
        </div>
        <button id="submit-btn">
            Donate $1
            <span class="spinner"></span>
        </button>
    </form>
    <div id="error-message"></div>
    <p><a href="/logout">Logout</a></p>
    <script>
        var stripe = Stripe('${STRIPE_PUBLISHABLE_KEY}');
        var elements = stripe.elements();
        
        var cardNumber = elements.create('cardNumber');
        cardNumber.mount('#card-number');
        
        var cardCvc = elements.create('cardCvc');
        cardCvc.mount('#card-cvc');
        
        var cardExp = elements.create('cardExpiry');
        cardExp.mount('#card-exp');
        
        var form = document.getElementById('payment-form');
        var submitBtn = document.getElementById('submit-btn');
        
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
            
            stripe.createToken(cardNumber).then(function(result) {
                if (result.error) {
                    document.getElementById('error-message').textContent = result.error.message;
                    submitBtn.classList.remove('loading');
                    submitBtn.disabled = false;
                } else {
                    fetch('/charge', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({token: result.token.id})
                    }).then(function(response) {
                        return response.json();
                    }).then(function(data) {
                        submitBtn.classList.remove('loading');
                        submitBtn.disabled = false;
                        
                        if (data.success) {
                            alert('Payment successful!');
                        } else {
                            alert('Payment failed: ' + data.error);
                        }
                    }).catch(function(error) {
                        submitBtn.classList.remove('loading');
                        submitBtn.disabled = false;
                        alert('An error occurred: ' + error.message);
                    });
                }
            });
        });
    </script>
</body>
</html>
    `);
});

app.route('/login')
    .get((req, res) => {
        res.send(`
<!doctype html>
<html>
<head>
    <title>Admin Login</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; }
        input { width: 100%; padding: 8px; box-sizing: border-box; }
        button { background-color: #4CAF50; color: white; padding: 10px 15px; border: none; cursor: pointer; }
        .error { color: red; }
    </style>
</head>
<body>
    <h1>Admin Login</h1>
    <form method="POST" action="/login">
        <div class="form-group">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required>
        </div>
        <div class="form-group">
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required>
        </div>
        <button type="submit">Login</button>
    </form>
</body>
</html>
        `);
    })
    .post((req, res) => {
        const { username, password } = req.body;
        
        if (ADMIN_CREDENTIALS[username] && ADMIN_CREDENTIALS[username] === password) {
            req.session.loggedIn = true;
            req.session.username = username;
            return res.redirect('/');
        } else {
            res.send(`
<!doctype html>
<html>
<head>
    <title>Admin Login</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; }
        input { width: 100%; padding: 8px; box-sizing: border-box; }
        button { background-color: #4CAF50; color: white; padding: 10px 15px; border: none; cursor: pointer; }
        .error { color: red; }
    </style>
</head>
<body>
    <h1>Admin Login</h1>
    <p class="error">Invalid username or password</p>
    <form method="POST" action="/login">
        <div class="form-group">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required>
        </div>
        <div class="form-group">
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required>
        </div>
        <button type="submit">Login</button>
    </form>
</body>
</html>
            `);
        }
    });

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
        }
        res.redirect('/login');
    });
});

app.post('/charge', async (req, res) => {
    if (!req.session.loggedIn) {
        return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    try {
        const proxyAgent = getProxyAgent();
        const stripeOptions = {
            apiVersion: '2020-08-27',
            maxNetworkRetries: 2
        };

        if (proxyAgent) {
            stripeOptions.httpAgent = proxyAgent;
            stripeOptions.timeout = 15000;
        }

        // Create new Stripe instance with proxy configuration
        const stripeWithProxy = require('stripe')(
            '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',
            stripeOptions
        );

        const charge = await stripeWithProxy.charges.create({
            amount: 100,
            currency: 'usd',
            source: req.body.token,
            description: 'Donation'
        });
        
        res.json({ success: true });
    } catch (err) {
        console.error('Payment error:', err);
        rotateProxy();
        res.json({ 
            success: false, 
            error: err.type === 'StripeConnectionError' ? 
                  'Connection error, please try again' : 
                  err.message 
        });
    }
});

// Test proxy route
app.get('/test-proxy', async (req, res) => {
    try {
        const proxyAgent = getProxyAgent();
        if (!proxyAgent) {
            return res.status(400).send('No proxies configured');
        }

        const response = await axios.get('https://httpbin.org/ip', {
            httpsAgent: proxyAgent,
            timeout: 5000
        });

        res.send(`
            <!doctype html>
            <html>
            <head>
                <title>Proxy Test</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; }
                    button { 
                        background-color: #4CAF50; 
                        color: white; 
                        padding: 10px 15px; 
                        border: none; 
                        cursor: pointer; 
                        margin: 5px;
                    }
                    .proxy-info {
                        background: #f5f5f5;
                        padding: 10px;
                        border-radius: 5px;
                        margin: 10px 0;
                    }
                </style>
            </head>
            <body>
                <h1>Proxy Test</h1>
                <div class="proxy-info">
                    <p><strong>Current proxy:</strong> ${PROXIES[currentProxyIndex]}</p>
                    <p><strong>Your IP:</strong> ${response.data.origin}</p>
                </div>
                <button onclick="location.reload()">Test Again</button>
                <button onclick="window.location.href='/rotate-proxy'">Rotate Proxy</button>
                <p><a href="/">Back to Home</a></p>
            </body>
            </html>
        `);
    } catch (err) {
        rotateProxy();
        res.status(500).send(`
            <!doctype html>
            <html>
            <head>
                <title>Proxy Test Failed</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; }
                    .error { color: red; }
                    button { 
                        background-color: #4CAF50; 
                        color: white; 
                        padding: 10px 15px; 
                        border: none; 
                        cursor: pointer; 
                        margin: 5px;
                    }
                </style>
            </head>
            <body>
                <h1>Proxy Test Failed</h1>
                <p class="error">Error: ${err.message}</p>
                <p>Rotated to next proxy automatically.</p>
                <button onclick="location.reload()">Try Again</button>
                <p><a href="/">Back to Home</a></p>
            </body>
            </html>
        `);
    }
});

app.get('/rotate-proxy', (req, res) => {
    rotateProxy();
    res.redirect('/test-proxy');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).send('Internal Server Error');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Configured ${PROXIES.length} proxies`);
    if (PROXIES.length > 0) {
        console.log(`Current proxy: ${PROXIES[currentProxyIndex]}`);
    }
});
