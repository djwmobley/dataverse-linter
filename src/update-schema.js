const fs = require('fs');
const path = require('path');

const config = {
    tenantId: process.env.DATAVERSE_TENANT_ID,
    clientId: process.env.DATAVERSE_CLIENT_ID,
    clientSecret: process.env.DATAVERSE_CLIENT_SECRET,
    environmentUrl: process.env.DATAVERSE_ENV_URL,
};

async function authenticate() {
    if (!config.tenantId || !config.clientId || !config.clientSecret || !config.environmentUrl) {
        console.warn('[Auth] Missing environment variables for live auth. Using stub token.');
        return 'STUB_ACCESS_TOKEN';
    }

    console.log('[Auth] Authenticating against live Dataverse...');
    const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: `${config.environmentUrl}/.default`,
        grant_type: 'client_credentials'
    });

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Authentication failed: ${response.status} ${err}`);
    }

    const data = await response.json();
    return data.access_token;
}

async function fetchMetadata(token, mockFilePath = null) {
    if (mockFilePath) {
        console.log('[Fetch] Using mock metadata from ' + mockFilePath);
        return fs.promises.readFile(mockFilePath, 'utf8');
    }

    if (token === 'STUB_ACCESS_TOKEN') {
        throw new Error('Cannot fetch live metadata with stub token. Provide valid credentials or use --mock.');
    }

    console.log(`[Fetch] Fetching live metadata from ${config.environmentUrl}/api/data/v9.2/$metadata...`);
    const metadataUrl = `${config.environmentUrl}/api/data/v9.2/$metadata`;
    const response = await fetch(metadataUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/xml'
        }
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Failed to fetch metadata: ${response.status} ${err}`);
    }

    return response.text();
}

async function updateSchema(mockXmlPath = null) {
    try {
        const token = await authenticate();
        const xmlContent = await fetchMetadata(token, mockXmlPath);

        console.log('[Parse] Extracting entities and types...');
        const entities = [];

        const entityRegex = /<EntityType\s+Name="([^"]+)">([\s\S]*?)<\/EntityType>/g;
        let match;
        while ((match = entityRegex.exec(xmlContent)) !== null) {
            const entityName = match[1];
            const propertiesStr = match[2];
            const properties = {};
            const propRegex = /<Property\s+Name="([^"]+)"\s+Type="([^"]+)"/g;
            let propMatch;
            while ((propMatch = propRegex.exec(propertiesStr)) !== null) {
                properties[propMatch[1]] = propMatch[2];
            }
            entities.push({ name: entityName, properties });
        }

        const schemaPath = path.join(__dirname, '..', 'rules', 'schema.json');
        const schemaOutput = { lastUpdated: new Date().toISOString(), entities };
        await fs.promises.writeFile(schemaPath, JSON.stringify(schemaOutput, null, 2), 'utf8');
        console.log('[Success] Schema written to ' + schemaPath);
    } catch (error) {
        console.error('[Error] ' + error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const mockIndex = args.indexOf('--mock');
    const mockFilePath = mockIndex !== -1 ? args[mockIndex + 1] : null;
    updateSchema(mockFilePath);
}
