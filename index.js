const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');

const app = express();

// Configuration
const PORT = 4242;
const STRIPE_SECRET_KEY = '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';
const STRIPE_PUBLISHABLE_KEY = "pk_live_51QbzeqLl4i0ezpvgMNxhBAOxYJx98hOqrZyDPD0GbbJgwW8CqCA1oFdQHMuQkv2uItfpQ6O3qifBcyw3En8TbnRy00ZWCDiHWl";
const ADMIN_CREDENTIALS = {
    'amine': 'x3x'
};

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: '1GH650339',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

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
                            alert('Payment successful!\\nCharge ID: ' + data.charge.id + '\\nAmount: $' + (data.charge.amount/100).toFixed(2));
                        } else {
                            let errorMsg = 'Payment failed: ' + data.error;
                            if (data.decline_code) {
                                errorMsg += '\\nDecline code: ' + data.decline_code;
                            }
                            alert(errorMsg);
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
        return res.status(403).json({ 
            success: false, 
            error: 'Not authorized' 
        });
    }
    
    try {
        const stripeInstance = require('stripe')(STRIPE_SECRET_KEY, {
            apiVersion: '2020-08-27',
            maxNetworkRetries: 2,
            timeout: 20000
        });

        const charge = await stripeInstance.charges.create({
            amount: 100, // Changed to $1 (100 cents)
            currency: 'usd',
            source: req.body.token,
            description: 'Donation'
        });

        res.json({ 
            success: true,
            charge: {
                id: charge.id,
                amount: charge.amount,
                currency: charge.currency,
                status: charge.status,
                created: charge.created
            }
        });
    } catch (err) {
        console.error('Payment error:', err);
        
        res.json({ 
            success: false, 
            error: err.message,
            decline_code: err.raw?.decline_code || null,
            type: err.type || 'unknown_error'
        });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).send('Internal Server Error');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
