import type { RecipeRegistry } from '../types'
import { RECIPE_PROP_1 } from './prop1'
import { RECIPE_PROP_2 } from './prop2'
import { RECIPE_PROP_3 } from './prop3'

export { RECIPE_PROP_1, PROP_1_ANNOTATIONS } from './prop1'
export { RECIPE_PROP_2, PROP_2_ANNOTATIONS } from './prop2'
export { RECIPE_PROP_3, PROP_3_ANNOTATIONS } from './prop3'

/** Registry mapping propId → ConstructionRecipe */
export const RECIPE_REGISTRY: RecipeRegistry = {
  1: RECIPE_PROP_1,
  2: RECIPE_PROP_2,
  3: RECIPE_PROP_3,
}
