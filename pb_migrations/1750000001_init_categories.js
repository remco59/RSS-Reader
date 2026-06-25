/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = new Collection({
        "id": "categories0001",
        "name": "categories",
        "type": "base",
        "fields": [
            { "type": "text",     "name": "name",  "required": true, "max": 100 },
            { "type": "text",     "name": "color",               "max": 20 },
            { "type": "text",     "name": "icon",                "max": 50 },
            { "type": "relation", "name": "user",  "collectionId": "_pb_users_auth_", "cascadeDelete": true, "maxSelect": 1 }
        ],
        "listRule":   "@request.auth.id != '' && (user = '' || user = @request.auth.id)",
        "viewRule":   "@request.auth.id != '' && (user = '' || user = @request.auth.id)",
        "createRule": "@request.auth.id != ''",
        "updateRule": "@request.auth.id != '' && (user = '' || user = @request.auth.id)",
        "deleteRule": "@request.auth.id != '' && user = @request.auth.id"
    });
    app.save(collection);
}, (app) => {
    app.delete(app.findCollectionByNameOrId("categories0001"));
});
