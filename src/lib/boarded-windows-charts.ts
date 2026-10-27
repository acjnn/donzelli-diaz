// The chart specs the "Boarded Windows" post renders, built at build time from
// the CSVs in src/dataset/boarded-windows. The builders live in boarded-windows.ts.

import democracyCsv from "../dataset/boarded-windows/electoral-democracy.csv?raw";
import hicpCsv from "../dataset/boarded-windows/hicp-annual-rates.csv?raw";
import energyCsv from "../dataset/boarded-windows/energy-prices-monthly.csv?raw";
import gasCsv from "../dataset/boarded-windows/gas-imports-italy-annual.csv?raw";
import gdpCsv from "../dataset/boarded-windows/gdp-income-components.csv?raw";
import wagesCsv from "../dataset/boarded-windows/oecd-real-wages.csv?raw";
import productivityCsv from "../dataset/boarded-windows/productivity-per-hour.csv?raw";
import housingCsv from "../dataset/boarded-windows/housing-overburden.csv?raw";
import airbnbCsv from "../dataset/boarded-windows/milan-airbnb-by-neighbourhood.csv?raw";
import milanGeo from "../dataset/boarded-windows/milan-neighbourhoods.geojson?raw";
import powerCsv from "../dataset/boarded-windows/business-electricity.csv?raw";
import taxCsv from "../dataset/boarded-windows/tax-wedge-2025.csv?raw";
import {
	businessPowerChart,
	deflatorChart,
	democracyChart,
	energyChart,
	fossilHoursChart,
	gasImportChart,
	housingBurdenChart,
	inflationHeatmap,
	milanGrowthChart,
	milanMap,
	productivityChart,
	realWageChart,
	septemberChart,
	taxWedgeChart,
} from "./boarded-windows";

export const democracy = democracyChart(democracyCsv);
export const september = septemberChart(hicpCsv);
export const heatmap = inflationHeatmap(hicpCsv);
export const fossilHours = fossilHoursChart();
export const energy = energyChart(energyCsv);
export const gasImports = gasImportChart(gasCsv);
export const deflator = deflatorChart(gdpCsv);
export const realWages = realWageChart(wagesCsv);
export const productivity = productivityChart(productivityCsv);
export const milanGrowth = milanGrowthChart();
export const housingBurden = housingBurdenChart(housingCsv);
export const airbnbMap = milanMap(milanGeo, airbnbCsv);
export const businessPower = businessPowerChart(powerCsv);
export const taxWedge = taxWedgeChart(taxCsv);
