/**
 * Currency Routes
 * Sprint 005 - TASK-010
 *
 * Endpoint to list supported currencies with current exchange rates.
 */

import { Elysia, t } from "elysia";
import { success, error, ErrorCodes } from "../lib/responses";
import { logger } from "../lib/logger";
import {
  SUPPORTED_CURRENCIES,
  getExchangeRateService,
} from "../services/currency";

// ============================================================================
// Currency Routes
// ============================================================================

export const currencyRoutes = new Elysia({ prefix: "/currencies" })
  // ========================================================================
  // GET /currencies - List Supported Currencies with Current Rates
  // AC-1.11: Support major currencies: USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY
  // AC-1.12: Currency list endpoint with current rates
  // ========================================================================
  .get(
    "/",
    async ({ set }) => {
      try {
        const exchangeService = getExchangeRateService();
        const rates = await exchangeService.getRates();

        // Build currency list with current rates (relative to USD)
        const currencies = Object.values(SUPPORTED_CURRENCIES).map((currency) => ({
          code: currency.code,
          name: currency.name,
          symbol: currency.symbol,
          decimals: currency.decimals,
          // Rate is how many of this currency equals 1 USD
          rate: rates.rates[currency.code] || 1,
        }));

        return success({
          currencies,
          baseCurrency: "USD",
          lastUpdated: rates.timestamp.toISOString(),
          // Indicate if using cached/fallback rates
          isFallback: rates.isFallback || false,
        });
      } catch (err) {
        logger.error("Failed to fetch currency rates", { error: String(err) });
        set.status = 500;
        return error(
          ErrorCodes.INTERNAL_ERROR,
          "Failed to fetch exchange rates"
        );
      }
    },
    {
      detail: {
        summary: "List supported currencies",
        description:
          "Returns all supported currencies with their current exchange rates relative to USD",
        tags: ["Currencies"],
      },
    }
  )

  // ========================================================================
  // GET /currencies/:code - Get Single Currency Details
  // ========================================================================
  .get(
    "/:code",
    async ({ params, set }) => {
      const code = params.code.toUpperCase();
      const currency = SUPPORTED_CURRENCIES[code];

      if (!currency) {
        set.status = 404;
        return error(
          ErrorCodes.NOT_FOUND,
          `Currency '${code}' is not supported`
        );
      }

      try {
        const exchangeService = getExchangeRateService();
        const rates = await exchangeService.getRates();

        return success({
          code: currency.code,
          name: currency.name,
          symbol: currency.symbol,
          decimals: currency.decimals,
          rate: rates.rates[currency.code] || 1,
          baseCurrency: "USD",
          lastUpdated: rates.timestamp.toISOString(),
        });
      } catch (err) {
        logger.error("Failed to fetch currency rate", { error: String(err) });
        set.status = 500;
        return error(
          ErrorCodes.INTERNAL_ERROR,
          "Failed to fetch exchange rate"
        );
      }
    },
    {
      params: t.Object({
        code: t.String({ minLength: 3, maxLength: 3 }),
      }),
      detail: {
        summary: "Get currency details",
        description: "Returns details for a specific currency including current exchange rate",
        tags: ["Currencies"],
      },
    }
  );
