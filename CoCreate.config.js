module.exports = {
    "config": {
        "organization_id": "",
        "key": "",
        "host": ""
    },
    "sources": [
        {
            "collection": "files",
            "document": {
                "_id": "",
                "name": "index.html",
                "path": "/docs/events/index.html",
                "src": "{{./docs/index.html}}",
                "hosts": [
                    "*",
                    "general.cocreate.app"
                ],
                "directory": "/docs/events",
                "parentDirectory": "{{parentDirectory}}",
                "content-type": "{{content-type}}",
                "public": "true",
                "website_id": "644d4bff8036fb9d1d1fd69c"
            }
        }
    ]
}