# TensorFlow.js Model Debugging (Keras → Browser)

**CRITICAL: When a trained Keras model works in Python but fails in the browser, check these issues.**

## 1. Normalization Mismatch (Most Common)

**The Problem:** Keras models often include preprocessing layers (like `Rescaling`) that are preserved in SavedModel export but easy to forget about.

**The Failure Pattern (January 2025):**

- Model trained with `Rescaling(scale=2.0, offset=-1.0)` layer (converts `[0,1]` → `[-1,1]`)
- Browser code assumed the layer was stripped, manually applied `[-1,1]` normalization
- Result: Double normalization, completely wrong predictions
- Python test confirmed model expects `[0,1]` input (Rescaling layer IS preserved)

**How to Debug:**

```bash
# Test the model locally with Python to find correct normalization
python scripts/test_model.py --digit 3 --count 5

# Compare different normalizations
python scripts/test_model.py --compare-norm --digit 3
```

**The Fix:** Check your model architecture for preprocessing layers:

```python
model.summary()  # Look for Rescaling, Normalization layers
```

If the model has internal normalization, your browser code should NOT duplicate it.

## 2. Quantization Corruption

**The Problem:** TensorFlow.js `--quantize_uint8` flag can corrupt model weights.

**Symptoms:**

- Model works perfectly in Python
- Same model gives completely different (wrong) results in browser
- Not a normalization issue (verified with Python testing)

**The Fix:** Export without quantization:

```bash
# ❌ WRONG - quantization corrupts weights
tensorflowjs_converter --quantize_uint8 ...

# ✅ CORRECT - no quantization
tensorflowjs_converter \
  --input_format=tf_saved_model \
  --output_format=tfjs_graph_model \
  saved_model_dir \
  output_dir
```

Model size increases (556KB → 2.2MB) but predictions are correct.

## 3. Output Tensor Ordering

**The Problem:** Multi-head models may have outputs in different order between Keras and GraphModel.

**The Fix:** Detect output types by shape, not by index:

```typescript
// Heaven output: shape [batch, 1] (binary sigmoid)
// Earth output: shape [batch, 5] (5-class softmax)
const shape0Last = output[0].shape[output[0].shape.length - 1];
if (shape0Last === 1) {
  // output[0] is heaven
} else if (shape0Last === 5) {
  // output[0] is earth (swapped!)
}
```

## Debugging Checklist

When browser inference gives wrong results:

1. **Create a Python test script** that loads the same model and tests with known images
2. **Verify normalization** - what range does Python expect? `[0,1]` or `[-1,1]`?
3. **Check for preprocessing layers** in model architecture (`model.summary()`)
4. **Try without quantization** - re-export the model without `--quantize_uint8`
5. **Verify output ordering** - log shapes and compare to expected
6. **Test with the exact same image** in both Python and browser

## Key Files

- `scripts/test_model.py` - Python script for local model testing
- `src/lib/vision/columnClassifier.ts` - Browser inference code
- `scripts/train-column-classifier/train_model.py` - Model training and export
