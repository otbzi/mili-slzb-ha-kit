let currentSeq = 0;
function getNextSeq() {
    currentSeq = (currentSeq + 1) % 256;
    return currentSeq;
}

const definition = {
    fingerprint: [{modelID: 'TS0601', manufacturerName: '_TZE200_dgtgaoc9'}],
    model: 'TS0601_milih_4gang_wireless_scene',
    vendor: 'Tuya',
    description: '米立 4键无线情景开关 (仅单击)',
    
    options: [], 
    exposes: [
        {
            type: 'enum',
            name: 'action',
            property: 'action',
            access: 1, 
            values: ['button_1', 'button_2', 'button_3', 'button_4'],
            description: '无线情景按键触发的动作事件',
            options: []
        }
    ],
    
    fromZigbee: [{
        cluster: 'manuSpecificTuya',
        type: ['commandDataResponse', 'commandDataReport'],
        options: [], 
        convert: (model, msg, publish, options, meta) => {
            const dpValues = msg.data.dpValues;
            const result = {};
            
            for (const dpValue of dpValues) {
                const dp = dpValue.dp;
                
                if (dp === 1) {
                    result.action = 'button_1';
                }
                if (dp === 2) {
                    result.action = 'button_2';
                }
                if (dp === 3) {
                    result.action = 'button_3';
                }
                if (dp === 4) {
                    result.action = 'button_4';
                }
            }
            return result;
        }
    }],

    toZigbee: [], 

    meta: {},
    endpoint: (device) => {
        return {'button_1': 1, 'button_2': 1, 'button_3': 1, 'button_4': 1};
    },
};

module.exports = definition;

