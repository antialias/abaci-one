include <BOSL2/std.scad>;      // BOSL2 v2.0 or newer

// ----  USER CUSTOMIZABLE PARAMETERS  ----
// These can be overridden via command line: -D 'columns=7' etc.
columns = 13;          // Total number of columns (1-13, mirrored book design)
scale_factor = 1.5;    // Overall size scale (preserves aspect ratio)
// -----------------------------------------

stl_path = "./simplified.abacus.stl";

// Calculate parameters based on column count
// The full STL has 13 columns. We want columns/2 per side (mirrored).
// The original bounding box intersection: scale([35/186, 1, 1])
// 35/186 ≈ 0.188 = ~2.44 columns, so 186 units ≈ 13 columns, ~14.3 units per column
total_columns_in_stl = 13;
columns_per_side = columns / 2;
width_scale = columns_per_side / total_columns_in_stl;

// Column spacing: distance between mirrored halves
// Original spacing of 69 for ~2.4 columns/side
// Calculate proportional spacing based on columns
units_per_column = 186 / total_columns_in_stl;  // ~14.3 units per column
column_spacing = columns_per_side * units_per_column;

// --- actual model ---
module imported()
    import(stl_path, convexity = 10);

module half_abacus() {
	intersection() {
		scale([width_scale, 1, 1]) bounding_box() imported();
		imported();
	}
}

scale([scale_factor, scale_factor, scale_factor]) {
	translate([column_spacing, 0, 0]) mirror([1,0,0]) half_abacus();
	half_abacus();
}
