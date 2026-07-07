from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app.modules.capabilities import models as capability_models  # noqa: E402,F401
from app.modules.audit import models as audit_models  # noqa: E402,F401
from app.modules.marketplace import models as marketplace_models  # noqa: E402,F401
from app.modules.home import models as home_models  # noqa: E402,F401
from app.modules.roles import models as role_models  # noqa: E402,F401
from app.modules.users import models as user_models  # noqa: E402,F401
from app.modules.mcp_runtime import models as mcp_runtime_models  # noqa: E402,F401
from app.modules.business_categories import models as business_category_models  # noqa: E402,F401
