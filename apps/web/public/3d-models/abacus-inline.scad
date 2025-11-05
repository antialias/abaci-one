// Inline version of abacus.scad that doesn't require BOSL2
// This version uses a hardcoded bounding box size instead of the bounding_box() function

// ----  USER CUSTOMIZABLE PARAMETERS  ----
// These can be overridden via command line: -D 'columns=7' etc.
columns = 13;          // Total number of columns (1-13, mirrored book design)
scale_factor = 1.5;    // Overall size scale (preserves aspect ratio)
// -----------------------------------------

stl_path = "/3d-models/simplified.abacus.stl";

// Known bounding box dimensions of the simplified.abacus.stl file
// These were measured from the original file
bbox_size = [186, 60, 120];  // [width, depth, height] in STL units

// Calculate parameters based on column count
// The full STL has 13 columns. We want columns/2 per side (mirrored).
total_columns_in_stl = 13;
columns_per_side = columns / 2;
width_scale = columns_per_side / total_columns_in_stl;

// Column spacing: distance between mirrored halves
units_per_column = bbox_size[0] / total_columns_in_stl;  // ~14.3 units per column
column_spacing = columns_per_side * units_per_column;

// --- actual model ---
module imported() {
    import(stl_path, convexity = 10);
}

// Create a bounding box manually instead of using BOSL2's bounding_box()
module bounding_box_manual() {
    translate([-bbox_size[0]/2, -bbox_size[1]/2, -bbox_size[2]/2])
        cube(bbox_size);
}

module half_abacus() {
    intersection() {
        scale([width_scale, 1, 1]) bounding_box_manual();
        imported();
    }
}

scale([scale_factor, scale_factor, scale_factor]) {
    translate([column_spacing, 0, 0]) mirror([1,0,0]) half_abacus();
    half_abacus();
}
