/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = new Collection({
        "id": "feeds000000001",
        "name": "feeds",
        "type": "base",
        "fields": [
            { "type": "text",     "name": "name",               "required": true, "max": 200 },
            { "type": "url",      "name": "url",                "required": true },
            { "type": "select",   "name": "type",               "required": true, "maxSelect": 1, "values": ["rss", "instagram", "facebook", "youtube"] },
            { "type": "relation", "name": "category",           "collectionId": "categories0001", "cascadeDelete": false, "maxSelect": 1 },
            { "type": "text",     "name": "description",                          "max": 500 },
            { "type": "url",      "name": "favicon" },
            { "type": "number",   "name": "fetch_interval_mins", "min": 5, "max": 1440, "noDecimal": true },
            { "type": "date",     "name": "last_fetched" },
            { "type": "bool",     "name": "is_active" }
        ],
        "indexes": [
            "CREATE UNIQUE INDEX idx_feeds_url ON feeds (url)"
        ],
        "listRule":   "@request.auth.id != ''",
        "viewRule":   "@request.auth.id != ''",
        "createRule": "@request.auth.id != ''",
        "updateRule": "@request.auth.id != ''",
        "deleteRule": "@request.auth.id != ''"
    });
    app.save(collection);
}, (app) => {
    app.delete(app.findCollectionByNameOrId("feeds000000001"));
});
