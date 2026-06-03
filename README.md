# 深蓝鲜集水产品下单页

这是一个可直接部署到 GitHub Pages 的静态下单页。未配置数据库时，订单和库存会保存到浏览器本地；配置 Supabase 免费层后，订单会写入云端，库存会在下单时扣减。

## 免费持久化订单

1. 创建 Supabase 免费项目。
2. 在 Supabase SQL Editor 运行 `supabase/schema.sql`。
3. 在 `app_settings` 表把 `admin_token` 从 `CHANGE_ME_BEFORE_DEPLOY` 改成你的管理密钥。
4. 把 `config.sample.js` 的内容复制到 `config.js`，填入项目 URL 和 anon public key。

## 上线前清空并恢复库存

远端模式：打开 `admin.html`，输入管理密钥，点击“重置远端数据”。

也可以在 Supabase SQL Editor 运行 `supabase/launch-reset.sql`。

本地演示模式：打开 `admin.html`，点击“重置本地数据”。

## GitHub Pages

仓库根目录指向本文件所在目录即可发布；也可以把这些文件放到仓库根目录后启用 Pages。
