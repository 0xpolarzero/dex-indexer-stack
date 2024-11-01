DROP function buy_token;

CREATE OR REPLACE FUNCTION public.buy_token(user_wallet varchar, token_id uuid, amount_to_buy numeric, token_cost numeric DEFAULT NULL::numeric)
 RETURNS token_transaction
 LANGUAGE plpgsql
AS $function$
DECLARE
    latest_price NUMERIC;
    total_cost NUMERIC;
    wallet_balance NUMERIC;
    wallet_transaction_id UUID;
    token_txn token_transaction%ROWTYPE;
BEGIN
    -- Lock the account to prevent concurrent transactions
    PERFORM pg_advisory_xact_lock(hashtext(user_wallet::text));
    -- Determine the latest price
    IF token_cost IS NOT NULL THEN
        latest_price := token_cost;
    ELSE
        -- Get the latest price of the token
        SELECT price INTO latest_price
        FROM token_price_history
        WHERE token = token_id
        ORDER BY created_at DESC
        LIMIT 1;
        IF latest_price IS NULL THEN
            RAISE EXCEPTION 'Token price not found for token_id %', token_id;
        END IF;
    END IF;
    -- Calculate total cost -- convert to lamports/gwei
    total_cost := latest_price/CAST(1e9 as NUMERIC) * amount_to_buy;
    -- Get account balance
    SELECT COALESCE(SUM(amount), 0) INTO wallet_balance
    FROM wallet_transaction
    WHERE wallet_transaction.wallet = user_wallet;
    -- Check if account has enough balance
    IF wallet_balance < total_cost THEN
        RAISE EXCEPTION 'Insufficient balance. Required: %, Available: %', total_cost, wallet_balance;
    END IF;
    -- Insert a new wallet_transaction for the cost (debit)
    INSERT INTO wallet_transaction (wallet, amount)
    VALUES (user_wallet, -total_cost)
    RETURNING id INTO wallet_transaction_id;
    -- Insert a new token_transaction for the tokens (credit)
    INSERT INTO token_transaction (token, amount, wallet_transaction)
    VALUES (token_id, amount_to_buy, wallet_transaction_id)
    RETURNING * INTO token_txn;
    -- Insert a new record into token_price_history
    INSERT INTO token_price_history (token, price, internal_token_transaction_ref)
    VALUES (token_id, latest_price, token_txn.id);
    -- Return the token_transaction record
    RETURN token_txn;
END;
$function$;
