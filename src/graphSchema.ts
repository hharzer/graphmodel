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

import { GraphSchemaCollection } from "./graphSchemaCollection";
import { GraphCategoryCollection } from "./graphCategoryCollection";
import { GraphPropertyCollection } from "./graphPropertyCollection";
import { Graph } from "./graph";
import { GraphCategory, GraphCategoryIdLike } from "./graphCategory";
import { GraphProperty, GraphPropertyIdLike } from "./graphProperty";
import { isGraphSchemaNameLIke } from "./utils";

/**
 * Represents a valid value for the name of a GraphSchema.
 */
export type GraphSchemaNameLike = string | symbol;

/**
 * A GraphSchema defines a related set of graph categories and properties.
 */
export class GraphSchema {
    private _graph: Graph | undefined;
    private _name: GraphSchemaNameLike;
    private _schemas: GraphSchemaCollection | undefined;
    private _categories: GraphCategoryCollection | undefined;
    private _properties: GraphPropertyCollection | undefined;
    private _observers: Map<GraphSchemaSubscription, GraphSchemaEvents> | undefined;

    constructor(name: GraphSchemaNameLike);
    /* @internal */ constructor(name: GraphSchemaNameLike, graph: Graph);
    constructor(name: GraphSchemaNameLike, graph?: Graph) {
        this._name = name;
        this._graph = graph;
    }

    /**
     * Gets the graph that owns the schema.
     */
    public get graph(): Graph | undefined {
        return this._graph;
    }

    /**
     * Gets the name of the schema.
     */
    public get name(): GraphSchemaNameLike {
        return this._name;
    }

    /**
     * Gets the child schemas of this schema.
     */
    public get schemas(): GraphSchemaCollection {
        return this._schemas ?? (this._schemas = GraphSchemaCollection._create(this));
    }

    /**
     * Gets the categories defined by this schema.
     */
    public get categories(): GraphCategoryCollection {
        return this._categories ?? (this._categories = GraphCategoryCollection._create(this));
    }

    /**
     * Gets the properties defined by this schema.
     */
    public get properties(): GraphPropertyCollection {
        return this._properties ?? (this._properties = GraphPropertyCollection._create(this));
    }

    /**
     * Creates a subscription for a set of named events.
     */
    public subscribe(events: GraphSchemaEvents): GraphSchemaSubscription {
        const observers = this._observers ?? (this._observers = new Map<GraphSchemaSubscription, GraphSchemaEvents>());
        const subscription: GraphSchemaSubscription = { unsubscribe: () => { observers.delete(subscription); } };
        this._observers.set(subscription, { ...events });
        return subscription;
    }

    /**
     * Determines whether this schema contains the provided schema as a child or grandchild.
     */
    public hasSchema(schema: GraphSchema | GraphSchemaNameLike): boolean {
        if (isGraphSchemaNameLIke(schema) ? schema === this.name : schema === this) {
            return true;
        }
        if (this._schemas !== undefined) {
            for (const value of this.schemas.values()) {
                if (value.hasSchema(schema)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Adds a child schema to this schema.
     */
    public addSchema(schema: GraphSchema): this {
        this.schemas.add(schema);
        return this;
    }

    /**
     * Creates an iterator for all schemas within this schema (including this schema).
     */
    public * allSchemas(): IterableIterator<GraphSchema> {
        yield this;
        if (this._schemas !== undefined) {
            for (const schema of this._schemas) {
                yield* schema.allSchemas();
            }
        }
    }

    /**
     * Finds a category in this schema or its descendants.
     */
    public findCategory(id: GraphCategoryIdLike): GraphCategory | undefined {
        for (const schema of this.allSchemas()) {
            if (schema._categories !== undefined) {
                const category = schema._categories.get(id);
                if (category !== undefined) {
                    return category;
                }
            }
        }
        return undefined;
    }

    /**
     * Creates an iterator for the categories in this schema or its descendants with the provided ids.
     */
    public * findCategories(...categoryIds: GraphCategoryIdLike[]): IterableIterator<GraphCategory> {
        for (const schema of this.allSchemas()) {
            if (schema._categories !== undefined) {
                yield* schema._categories.values(categoryIds);
            }
        }
    }

    /**
     * Finds a property in this schema or its descendants.
     */
    public findProperty(id: GraphPropertyIdLike): GraphProperty | undefined {
        for (const schema of this.allSchemas()) {
            if (schema._properties !== undefined) {
                const property = schema._properties.get(id);
                if (property !== undefined) {
                    return property;
                }
            }
        }
        return undefined;
    }

    /**
     * Creates an iterator for the properties in this schema or its descendants with the provided ids.
     */
    public * findProperties(...propertyIds: GraphPropertyIdLike[]): IterableIterator<GraphProperty> {
        for (const schema of this.allSchemas()) {
            if (schema._properties !== undefined) {
                yield* schema._properties.values(propertyIds);
            }
        }
    }

    /* @internal */ _raiseOnChanged() {
        if (this._observers !== undefined) {
            for (const { onChanged } of this._observers.values()) {
                onChanged?.();
            }
        }
    }
}

export interface GraphSchemaEvents {
    /**
     * An event raised when the schema or one of its child schemas has changed.
     */
    onChanged?: () => void;
}

export interface GraphSchemaSubscription {
    /**
     * Stops listening to a set of subscribed events.
     */
    unsubscribe(): void;
}
