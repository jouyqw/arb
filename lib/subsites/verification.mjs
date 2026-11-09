// Public ownership-verification values issued by Naver Search Advisor.
const naver={
 interior:'e9c75354b4903a7050e6afcf352cce13eedfc26a',
 cleaning:'ad4d2bb7b62fc300705974878e2effca06a856d6',
 demolition:'dd754b63740953a68ae5055167cbf54bbabe5a76',
 funeral:'38f620206e967bc6b63299c91d32a454dba2dd06',
 insurance:'04bd6362df993f7b6b8c3a730c08c969ec0c9c7a',
 shortform:'a18ba8f9323134f2ceccdbf81ad0fcfcede6d8b2'
};
export const verificationMeta=k=>Object.hasOwn(naver,k)?`<meta name="naver-site-verification" content="${naver[k]}">`:'';
