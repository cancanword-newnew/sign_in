// 配置文件 - 用户可根据需要修改
const CONFIG = {
    // API配置 - 由于CORS限制，需要配置代理或后端服务
    API_BASE_URL: '', // 留空表示直接调用，但可能遇到CORS问题
    
    // 学期设置
    DEFAULT_SEMESTER_START: {
        year: 2025,
        month: 9, // 注意：月份从1开始
        day: 1
    },
    
    // 功能开关
    FEATURES: {
        BATCH_SIGN: true,
        AUTO_REFRESH: false
    },
    
    // 请求配置
    REQUEST_TIMEOUT: 10000, // 10秒
    RETRY_ATTEMPTS: 3
};

// 如果没有配置API地址，尝试使用CORS代理
if (!CONFIG.API_BASE_URL) {
    // 这里可以添加公共CORS代理，但注意安全性和稳定性
    // CONFIG.API_BASE_URL = 'https://cors-anywhere.herokuapp.com/';
}
