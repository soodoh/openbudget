const ZERO_DECIMAL_CURRENCIES = new Set([
	"BIF",
	"CLP",
	"DJF",
	"GNF",
	"ISK",
	"JPY",
	"KMF",
	"KRW",
	"PYG",
	"RWF",
	"UGX",
	"VND",
	"VUV",
	"XAF",
	"XOF",
	"XPF",
]);

const THREE_DECIMAL_CURRENCIES = new Set([
	"BHD",
	"IQD",
	"JOD",
	"KWD",
	"LYD",
	"OMR",
	"TND",
]);

export function getMinorUnitExponent(currencyCode: string): number {
	if (ZERO_DECIMAL_CURRENCIES.has(currencyCode)) return 0;
	if (THREE_DECIMAL_CURRENCIES.has(currencyCode)) return 3;
	return 2;
}

export function toMinorUnits(amount: number, currencyCode: string): number {
	const exponent = getMinorUnitExponent(currencyCode);
	return Math.round(amount * 10 ** exponent);
}

export function fromMinorUnits(
	minorUnits: number,
	currencyCode: string,
): number {
	const exponent = getMinorUnitExponent(currencyCode);
	return minorUnits / 10 ** exponent;
}
