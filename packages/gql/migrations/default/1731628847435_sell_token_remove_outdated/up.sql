DROP FUNCTION public.sell_token;
CREATE OR REPLACE FUNCTION public.sell_token(
    user_wallet character varying,
    token text,
    amount_to_sell numeric,
    token_cost numeric DEFAULT NULL::numeric
) RETURNS token_transaction
LANGUAGE plpgsql AS $function$
DECLARE
    total_proceeds NUMERIC;
    token_balance NUMERIC;
    wallet_transaction_id UUID;
    token_txn token_transaction%ROWTYPE;
BEGIN
    -- Acquire an advisory lock on the wallet
    PERFORM pg_advisory_xact_lock(hashtext(user_wallet::text));

    -- Use provided token cost
    IF token_cost IS NULL THEN
        RAISE EXCEPTION 'Token cost must be provided';
    END IF;

    -- Calculate total proceeds
    total_proceeds := (token_cost * amount_to_sell) / CAST(1e9 AS NUMERIC);

    -- Get token balance
    SELECT COALESCE(SUM(amount), 0) INTO token_balance
    FROM token_transaction
    WHERE wallet_transaction IN (
        SELECT id FROM wallet_transaction WHERE wallet_transaction.wallet = user_wallet
    ) AND token = token;

    -- Check if wallet has enough tokens to sell
    IF token_balance < amount_to_sell THEN
        RAISE EXCEPTION 'Insufficient token balance. Available: %, Requested: %', token_balance, amount_to_sell;
    END IF;

    -- Insert a new wallet_transaction for the proceeds (credit)
    INSERT INTO wallet_transaction (wallet, amount)
    VALUES (user_wallet, total_proceeds)
    RETURNING id INTO wallet_transaction_id;

    -- Insert a new token_transaction for the tokens sold (debit)
    INSERT INTO token_transaction (token, amount, wallet_transaction)
    VALUES (token, -amount_to_sell, wallet_transaction_id)
    RETURNING * INTO token_txn;

    RETURN token_txn;
END;
$function$;
