import Stripe from "stripe";

//  payments from these origins will use test keys
const TEST_MODE_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
    "https://localhost",
    "https://127.0.0.1",
    "https://jk-frontend-nine.vercel.app"
];

// Check if an origin should use test mode
const isTestModeOrigin = (origin) => {
    if (!origin) return false;
    return TEST_MODE_ORIGINS.some(testOrigin =>
        origin.startsWith(testOrigin)
    );
};

// Get Stripe instance based on mode
const getStripe = (isTestMode) => {
    const secretKey = isTestMode
        ? process.env.STRIPE_SECRET_TEST_KEY
        : process.env.STRIPE_SECRET_LIVE_KEY;

    if (!secretKey) {
        throw new Error(`${isTestMode ? 'STRIPE_SECRET_TEST_KEY' : 'STRIPE_SECRET_LIVE_KEY'} is not configured in .env file`);
    }

    return new Stripe(secretKey);
};

// Create a PaymentIntent for the booking

export const createPaymentIntent = async (req, res) => {
    try {
        const { amount, currency = "gbp", bookingData, origin } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment amount",
            });
        }

        // Determine if this is test mode based on origin
        const isTestMode = isTestModeOrigin(origin);
        const stripe = getStripe(isTestMode);

        console.log(`Payment mode: ${isTestMode ? 'TEST' : 'LIVE'} | Origin: ${origin}`);

        // Extract data from nested structure
        const selectedVehicle = bookingData?.selectedVehicle || {};
        const passengerDetails = bookingData?.passengerDetails || {};
        const pricing = selectedVehicle?.pricing || {};
        const vehicleDetails = selectedVehicle || {};

        // Calculate child seat charge
        const numberOfChildren = passengerDetails?.numberOfChildren || 0;
        const childSeatPrice = pricing?.additionalCharges?.childSeatPrice || 0;
        const childSeatCharge = numberOfChildren * childSeatPrice;

        // Calculate final amount with child seat charge
        let finalAmount = amount;
        if (childSeatCharge > 0) {
            finalAmount = amount + childSeatCharge;
            console.log(`Child seat charge: ${numberOfChildren} children × £${childSeatPrice} = £${childSeatCharge}`);
            console.log(`Total: £${amount} + £${childSeatCharge} = £${finalAmount}`);
        }

        // Build customer name
        const customerName = `${passengerDetails.firstName || ''} ${passengerDetails.lastName || ''}`.trim();
        const customerEmail = passengerDetails.email || '';
        const customerPhone = `${passengerDetails.countryCode || ''}${passengerDetails.phone || ''}`.trim();

        // Create or retrieve Stripe Customer with full details
        let customer = null;
        if (customerEmail) {
            try {
                // Map country code to country name for Stripe
                const countryCodeMap = {
                    '+44': 'GB', '+1': 'US', '+91': 'IN', '+33': 'FR', '+49': 'DE',
                    '+39': 'IT', '+34': 'ES', '+31': 'NL', '+353': 'IE', '+61': 'AU',
                    '+971': 'AE', '+966': 'SA', '+86': 'CN', '+81': 'JP', '+82': 'KR',
                    '+65': 'SG', '+92': 'PK', '+880': 'BD', '+27': 'ZA', '+234': 'NG'
                };
                const customerCountry = countryCodeMap[passengerDetails.countryCode] || 'GB';

                // Search for existing customer by email
                const existingCustomers = await stripe.customers.list({
                    email: customerEmail,
                    limit: 1,
                });

                const customerData = {
                    name: customerName,
                    phone: customerPhone,
                    address: {
                        country: customerCountry,
                        city: '', // Not collected in form
                        line1: bookingData?.pickup?.address || bookingData?.pickup || '',
                    },
                    metadata: {
                        firstName: passengerDetails.firstName || '',
                        lastName: passengerDetails.lastName || '',
                        numberOfPassengers: String(passengerDetails.numberOfPassengers || 1),
                        numberOfChildren: String(numberOfChildren || 0),
                        numberOfSuitcases: String(passengerDetails.numberOfSuitcases || 0),
                    },
                };

                if (existingCustomers.data.length > 0) {
                    // Update existing customer
                    customer = await stripe.customers.update(existingCustomers.data[0].id, customerData);
                } else {
                    // Create new customer
                    customer = await stripe.customers.create({
                        email: customerEmail,
                        ...customerData,
                    });
                }
            } catch (customerError) {
                console.error("Error creating/updating Stripe customer:", customerError);
                // Continue without customer - payment will still work
            }
        }

        // Stripe metadata — only customer identity fields for fraud detection
        const metadata = {
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
        };

        // Remove empty fields so Stripe doesn't show blank entries
        Object.keys(metadata).forEach(key => {
            if (!metadata[key]) delete metadata[key];
        });

        // Payment Intent options
        const paymentIntentOptions = {
            amount: Math.round(finalAmount * 100), // Stripe expects amount in smallest currency unit (pence)
            currency,
            automatic_payment_methods: {
                enabled: true,
            },
            metadata,
            description: `Booking: ${bookingData?.pickup?.address || bookingData?.pickup || 'Pickup'} → ${bookingData?.dropoff?.address || bookingData?.dropoff || 'Dropoff'}`,
            receipt_email: customerEmail || undefined,
        };

        // Add customer if created
        if (customer) {
            paymentIntentOptions.customer = customer.id;
        }

        // For LIVE mode, require 3D Secure authentication for card payments
        if (!isTestMode) {
            paymentIntentOptions.payment_method_options = {
                card: {
                    request_three_d_secure: 'any', // Request 3DS for all cards that support it
                },
            };
        }

        // Create PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);

        res.status(200).json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            isTestMode, // Tell frontend which mode we're in
        });
    } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create payment intent",
            error: error.message,
        });
    }
};

/**
 * Get payment status by PaymentIntent ID
 */
export const getPaymentStatus = async (req, res) => {
    try {
        const { paymentIntentId } = req.params;
        const { origin } = req.query;

        // Use same mode detection for status check
        const isTestMode = isTestModeOrigin(origin);
        const stripe = getStripe(isTestMode);

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        res.status(200).json({
            success: true,
            status: paymentIntent.status,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            isTestMode,
        });
    } catch (error) {
        console.error("Error getting payment status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get payment status",
            error: error.message,
        });
    }
};
