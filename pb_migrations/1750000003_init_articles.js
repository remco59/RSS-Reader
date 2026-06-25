/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = new Collection({
        "id": "articles000001",
        "name": "articles",
        "type": "base",
        "fields": [
            { "type": "relation", "name": "feed",         "required": true, "collectionId": "feeds000000001", "cascadeDelete": true, "maxSelect": 1 },
            { "type": "text",     "name": "title",        "required": true, "max": 500 },
            { "type": "text",     "name": "summary",                        "max": 2000 },
            { "type": "editor",   "name": "content" },
            { "type": "url",      "name": "url",          "required": true },
            { "type": "url",      "name": "image_url" },
            { "type": "text",     "name": "author",                         "max": 200 },
            { "type": "date",     "name": "published_at" },
            { "type": "text",     "name": "guid",         "required": true, "max": 500 }
        ],
        "indexes": [
            "CREATE UNIQUE INDEX idx_articles_guid ON articles (guid)",
            "CREATE INDEX idx_articles_feed ON articles (feed)",
            "CREATE INDEX idx_articles_published ON articles (published_at DESC)"
        ],
        "listRule":   "@request.auth.id != ''",
        "viewRule":   "@request.auth.id != ''",
        "createRule": null,
        "updateRule": null,
        "deleteRule": null
    });
    app.save(collection);
}, (app) => {
    app.delete(app.findCollectionByNameOrId("articles000001"));
});
