/*!
 * Copyright 2017 Ron Buckton
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { GraphCategory, GraphCategoryIdLike } from "./graphCategory";
import { GraphProperty, GraphPropertyIdLike } from "./graphProperty";
import { Graph } from "./graph";
import { GraphSchema } from "./graphSchema";
import { isIterableObject, isGraphCategoryIdLike, isGraphPropertyIdLIke, getCategorySet } from "./utils";

/**
 * The base definition of an extensible graph object.
 */
export abstract class GraphObject {
    private _owner: Graph | undefined;
    private _categories: Set<GraphCategory> | undefined;
    private _properties: Map<GraphProperty, any> | undefined;
    private _observers: Map<GraphObjectSubscription, GraphObjectEvents> | undefined;

    constructor(owner?: Graph, category?: GraphCategory) {
        this._owner = owner;
        if (category) this.addCategory(category);
    }

    /**
     * Gets the graph that this object belongs to.
     */
    public get owner(): Graph | undefined {
        return this._owner;
    }

    /**
     * Gets the document schema for this object.
     */
    public get schema(): GraphSchema | undefined {
        return this._owner?.schema;
    }

    /**
     * Gets the number of categories in the object.
     */
    public get categoryCount(): number {
        return this._categories?.size ?? 0;
    }

    /**
     * Gets the number of properties in the object.
     */
    public get propertyCount(): number {
        return this._properties?.size ?? 0;
    }

    /**
     * Creates a subscription for a set of named events.
     */
    public subscribe(events: GraphObjectEvents): GraphObjectSubscription {
        const observers = this._observers ?? (this._observers = new Map<GraphObjectSubscription, GraphObjectEvents>());
        const subscription: GraphObjectSubscription = { unsubscribe: () => { observers.delete(subscription); } };
        this._observers.set(subscription, { ...events });
        return subscription;
    }

    /**
     * Determines whether the object has the specified category or categories.
     */
    public hasCategory(category: GraphCategoryIdLike | GraphCategory | Iterable<GraphCategory | GraphCategoryIdLike>) {
        return isIterableObject(category) ? this.hasCategoryInSet(category, "exact") :
            isGraphCategoryIdLike(category) ? this._hasCategoryId(category) :
            this._hasCategory(category);
    }

    /* @internal */ _hasCategoryId(categoryId: GraphCategoryIdLike) {
        if (this._categories === undefined) {
            return false;
        }
        
        for (const ownCategory of this._categories) {
            if (ownCategory._isBasedOnCategoryId(categoryId)) {
                return true;
            }
        }

        return false;
    }

    /* @internal */ _hasCategory(category: GraphCategory) {
        if (this._categories === undefined) {
            return false;
        }
        
        for (const ownCategory of this._categories) {
            if (ownCategory._isBasedOnCategory(category)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determines whether the object has any of the categories in the provided Set.
     * @param match Either `"exact"` to only match any category in the set, or `"inherited"` to match any category or any of its base categories in the set.
     */
    public hasCategoryInSet(categories: Iterable<GraphCategory | GraphCategoryIdLike>, match: "exact" | "inherited") {
        if (this._categories === undefined) {
            return false;
        }

        let categorySet = getCategorySet(categories);
        if (categorySet === undefined) {
            return false;
        }
        if (match === "inherited") {
            let inherited: Set<GraphCategory | GraphCategoryIdLike> | undefined;
            let category: GraphCategory | GraphCategoryIdLike | undefined;
            for (category of categorySet) {
                if (isGraphCategoryIdLike(category)) {
                    category = this.schema?.findCategory(category);
                }
                while (category !== undefined) {
                    if (inherited === undefined) {
                        inherited = new Set<GraphCategory | GraphCategoryIdLike>();
                    }
                    if (isGraphCategoryIdLike(category)) {
                        inherited.add(category);
                        category = this.schema?.findCategory(category);
                        if (!category) {
                            break;
                        }
                    }
                    inherited.add(category);
                    category = category.basedOn;
                }
            }
            if (inherited !== undefined) {
                categorySet = inherited;
            }
        }

        let category: GraphCategory | undefined;
        for (category of this._categories) {
            while (category !== undefined) {
                if (categorySet.has(category) || categorySet.has(category.id)) {
                    return true;
                }
                category = category.basedOn;
            }
        }

        return false;
    }

    /**
     * Adds a category to the object.
     */
    public addCategory(category: GraphCategory): this {
        if (this._categories === undefined) {
            this._categories = new Set<GraphCategory>();
        }
        if (!this._categories.has(category)) {
            this._categories.add(category);
            this._raiseOnCategoryChanged("add", category);
        }
        return this;
    }

    /**
     * Deletes a category from the object.
     */
    public deleteCategory(category: GraphCategory): boolean;
    /**
     * Deletes a category from the object.
     */
    public deleteCategory(category: GraphCategoryIdLike): GraphCategory | false;
    /**
     * Deletes a category from the object.
     */
    public deleteCategory(category: GraphCategory | GraphCategoryIdLike): GraphCategory | boolean;
    public deleteCategory(category: GraphCategory | GraphCategoryIdLike) {
        const categoryObj = isGraphCategoryIdLike(category) ? this.schema?.findCategory(category) : category;
        if (categoryObj === undefined) {
            return undefined;
        }
        if (this._categories?.delete(categoryObj)) {
            this._raiseOnCategoryChanged("delete", categoryObj);
            return isGraphCategoryIdLike(category) ? categoryObj : true;
        }
        return false;
    }

    /**
     * Determines whether the object has the specified property or has a category that defines the specified property.
     */
    public has(key: GraphPropertyIdLike | GraphProperty) {
        const propertyObj = isGraphPropertyIdLIke(key) ? this.schema?.findProperty(key) : key;
        if (propertyObj === undefined) {
            return false;
        }
        return this.hasOwn(propertyObj) || this._find(propertyObj) !== undefined;
    }

    /**
     * Determines whether the object has the specified property.
     */
    public hasOwn(property: GraphProperty | GraphPropertyIdLike) {
        const propertyObj = isGraphPropertyIdLIke(property) ? this.schema?.findProperty(property) : property;
        if (propertyObj === undefined) {
            return false;
        }
        return this._properties?.has(propertyObj) ?? false;
    }

    /**
     * Gets the value for the specified property.
     */
    public get<V>(key: GraphProperty<V>): V | undefined;
    /**
     * Gets the value for the specified property.
     */
    public get(key: GraphPropertyIdLike | GraphProperty): any;
    public get(key: GraphPropertyIdLike | GraphProperty): any {
        const propertyObj = isGraphPropertyIdLIke(key) ? this.schema && this.schema.findProperty(key) : key;
        if (propertyObj === undefined) {
            return undefined;
        }

        let value = this._properties?.get(propertyObj);
        if (value === undefined) {
            value = this._find(propertyObj)?.get(propertyObj);
        }

        if (value === undefined && this._owner !== undefined) {
            const metadata = propertyObj.getMetadata(this._owner);
            value = metadata.defaultValue;
        }

        return value;
    }

    /**
     * Sets the value for the specified property.
     */
    public set<V>(key: GraphProperty<V>, value: V | undefined): this;
    /**
     * Sets the value for the specified property.
     */
    public set(key: GraphPropertyIdLike | GraphProperty, value: any): this;
    public set(key: GraphPropertyIdLike | GraphProperty, value: any) {
        if (value === undefined) {
            this.delete(key);
            return this;
        }

        const propertyObj = isGraphPropertyIdLIke(key) ? this.schema?.findProperty(key) : key;
        if (propertyObj === undefined) {
            return this;
        }

        if (this._properties === undefined) {
            this._properties = new Map<GraphProperty, any>();
        }

        const ownValue = this._properties.get(propertyObj);
        if (value === ownValue) {
            return this;
        }

        const metadata = this._owner ? propertyObj.getMetadata(this._owner) : propertyObj.createDefaultMetadata();
        if (ownValue !== undefined && metadata.isImmutable) {
            return this;
        }

        if (metadata.canValidate && !metadata.validate(value)) {
            return this;
        }

        this._properties.set(propertyObj, value);
        this._raiseOnPropertyChanged(propertyObj);
        return this;
    }

    /**
     * Removes the specified property from the object.
     */
    public delete(key: GraphPropertyIdLike | GraphProperty): boolean {
        const property = isGraphPropertyIdLIke(key) ? this.schema?.findProperty(key) : key;
        if (property === undefined || !this._properties?.has(property)) {
            return false;
        }

        const metadata = this._owner ? property.getMetadata(this._owner) : property.createDefaultMetadata();
        if (!metadata.isRemovable) {
            return false;
        }

        this._properties.delete(property);
        this._raiseOnPropertyChanged(property);
        return true;
    }

    /**
     * Copies the categories of another graph object to this one.
     */
    public copyCategories(other: GraphObject): boolean {
        if (!other._categories?.size) {
            return false;
        }
        if (this._categories === undefined) {
            this._categories = new Set<GraphCategory>();
        }
        let changed = false;
        for (const category of other._categories) {
            if (!this._categories.has(category)) {
                this._owner?._importMetadata(other._owner, category);
                this._categories.add(category);
                this._raiseOnCategoryChanged("add", category);
                changed = true;
            }
        }
        return changed;
    }

    /**
     * Copies the properties and values of another graph object to this one.
     */
    public copyProperties(other: GraphObject): boolean {
        if (!other._properties?.size) {
            return false;
        }
        if (this._properties === undefined) {
            this._properties = new Map<GraphProperty, any>();
        }

        let changed = false;
        for (const [property, value] of other._properties) {
            const ownValue = this._properties.get(property);
            if (ownValue === value) {
                continue;
            }
            const metadata = this._owner?._importMetadata(other._owner, property);
            if (metadata) {
                if (!metadata.isSharable) {
                    continue;
                }
                if (metadata.isImmutable && ownValue !== undefined) {
                    continue;
                }
                if (metadata.canValidate && !metadata.validate(value)) {
                    continue;
                }
            }
            this._properties.set(property, value);
            this._raiseOnPropertyChanged(property);
            changed = true;
        }

        return changed;
    }

    /**
     * Creates an iterator for the properties in the object.
     */
    public * keys(): IterableIterator<GraphProperty> {
        if (this._properties !== undefined) {
            yield* this._properties.keys();
        }
    }

    /**
     * Creates an iterator for the properties in the object.
     */
    public * values(): IterableIterator<any> {
        if (this._properties !== undefined) {
            yield* this._properties.values();
        }
    }

    /**
     * Creates an iterator for the entries in the object.
     */
    public * entries(): IterableIterator<[GraphProperty, any]> {
        if (this._properties !== undefined) {
            yield* this._properties.entries();
        }
    }

    /**
     * Creates an iterator for the categories in the object.
     */
    public * categories(): IterableIterator<GraphCategory> {
        if (this._categories !== undefined) {
            yield* this._categories.values();
        }
    }

    /**
     * Creates an iterator for the entries in the object.
     */
    public [Symbol.iterator](): IterableIterator<[GraphProperty, any]> {
        return this.entries();
    }

    /* @internal */ _setOwner(owner: Graph) {
        if (owner !== undefined && this._owner === undefined) {
            this._owner = owner;
        }
    }

    /* @internal */ _mergeFrom(other: this) {
        let changed = false;
        if (this.copyProperties(other)) {
            changed = true;
        }
        if (this.copyCategories(other)) {
            changed = true;
        }
        return changed;
    }

    /* @internal */ _raiseOnCategoryChanged(change: "add" | "delete", category: GraphCategory) {
        if (this._observers !== undefined) {
            for (const { onCategoryChanged } of this._observers.values()) {
                onCategoryChanged?.(change, category);
            }
        }
    }

    /* @internal */ _raiseOnPropertyChanged(property: GraphProperty) {
        if (this._observers !== undefined) {
            for (const { onPropertyChanged } of this._observers.values()) {
                onPropertyChanged?.(property.id);
            }
        }
    }

    private _find(property: GraphProperty) {
        if (this._categories !== undefined && this._owner !== undefined) {
            let category: GraphCategory | undefined;
            for (category of this._categories) {
                while (category !== undefined) {
                    const metadata = category.getMetadata(this._owner);
                    if (metadata.hasOwn(property)) {
                        return metadata;
                    }
                    category = category.basedOn;
                }
            }
        }
        return undefined;
    }
}

export interface GraphObjectEvents {
    /**
     * An event raised when a category is added or removed from an object.
     */
    onCategoryChanged?: (change: "add" | "delete", category: GraphCategory) => void;

    /**
     * An event raised when a property changes on the object.
     */
    onPropertyChanged?: (name: GraphPropertyIdLike) => void;
}

export interface GraphObjectSubscription {
    /**
     * Stops listening to a set of subscribed events.
     */
    unsubscribe(): void;
}
