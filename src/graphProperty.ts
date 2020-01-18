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

import { GraphMetadataContainer } from "./graphMetadataContainer";
import { GraphMetadata } from "./graphMetadata";
import { Graph } from "./graph";
import { DataType } from "./dataType";

/**
 * Represents a valid value for the id of a GraphProperty.
 */
export type GraphPropertyIdLike = string | symbol;

/**
 * Graph properties are used to annotate graph objects such as nodes or links.
 */
export class GraphProperty<V = any> extends GraphMetadataContainer<V> {
    private _id: GraphPropertyIdLike;
    private _dataType: DataType<V> | undefined;

    /* @internal */ static _create<V>(id: GraphPropertyIdLike, dataType: DataType<V> | undefined, metadataFactory?: () => GraphMetadata<V>) {
        return new GraphProperty<V>(id, dataType, metadataFactory);
    }

    private constructor(id: GraphPropertyIdLike, dataType: DataType<V> | undefined, metadataFactory?: () => GraphMetadata<V>) {
        super(metadataFactory);
        this._id = id;
        this._dataType = dataType;
    }

    /**
     * The unique id of the property.
     */
    public get id(): GraphPropertyIdLike {
        return this._id;
    }

    /**
     * Gets the name of the underlying data type for this property;
     */
    public get dataType(): DataType<V> | undefined {
        return this._dataType;
    }

    /* @internal */ _validate(value: any) {
        return this._dataType?.validate(value) ?? true;
    }
}